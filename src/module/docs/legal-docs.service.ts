import { Injectable, StreamableFile } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';
import { LegalDoc, LegalDocStatus } from '../../schema/legal-docs.schema';
import { NewsCategory } from '../../schema/news-category.schema';
import { User } from '../../schema/user.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { Role } from '../../utils/role/role';
import { MinioService } from '../minio/minio.service';
import { CreateLegalDocDto } from './dto/create-legal-docs.req';
import { QueryLegalDocDto } from './dto/query-legal-docs.req';
import { UpdateLegalDocDto } from './dto/update-legal.docs.req';

const ALLOWED_DOC_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class LegalDocsService {
  constructor(
    @InjectModel(LegalDoc.name)
    private readonly legalDocModel: Model<LegalDoc>,

    @InjectModel(NewsCategory.name)
    private readonly newsCategoryModel: Model<NewsCategory>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly minioService: MinioService,
  ) {}

  // =========================
  // HELPERS
  // =========================

  private canModify(doc: any, userId: string, role: Role): boolean {
    if (role === Role.ADMIN) return true;
    return doc.createdBy?.toString() === userId;
  }

  private async findActiveDocForModify(id: string, userId: string, role: Role) {
    if (!Types.ObjectId.isValid(id)) {
      return {
        error: {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid legal doc id',
          content: null,
        },
        doc: null,
      };
    }

    const doc = await this.legalDocModel.findOne({
      _id: new Types.ObjectId(id),
      isActive: true,
    });

    if (!doc) {
      return {
        error: {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc not found',
          content: null,
        },
        doc: null,
      };
    }

    if (!this.canModify(doc, userId, role)) {
      return {
        error: {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to modify this document',
          content: null,
        },
        doc: null,
      };
    }

    return { error: null, doc };
  }

  private getPopulateQuery() {
    return [
      { path: 'createdBy', select: 'name email role' },
      { path: 'categoryId', select: 'name slug description' }, // populate category info
    ];
  }

  private async attachDocFileUrl(doc: any) {
    if (!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (obj.file?.objectName) {
      obj.file = await this.minioService.attachPresignedUrl(obj.file);
    }
    return obj;
  }

  private async attachDocListFileUrls(docs: any[]) {
    return Promise.all(docs.map((d) => this.attachDocFileUrl(d)));
  }

  /** Validate that the categoryId exists and is active */
  private async validateCategory(categoryId?: string) {
    if (!categoryId) return { error: null };

    if (!Types.ObjectId.isValid(categoryId)) {
      return {
        error: {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid category id',
          content: null,
        },
      };
    }

    const category = await this.newsCategoryModel.findOne({
      _id: new Types.ObjectId(categoryId),
      isActive: true,
    });

    if (!category) {
      return {
        error: {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Category not found',
          content: null,
        },
      };
    }

    return { error: null };
  }

  // =========================
  // CRUD
  // =========================

  async create(
    userId: string,
    dto: CreateLegalDocDto,
    file?: Express.Multer.File,
  ) {
    try {
      // Validate category if provided
      const { error: categoryError } = await this.validateCategory(
        dto.categoryId,
      );
      if (categoryError) return categoryError;

      let fileMetadata: any = null;
      if (file) {
        const uploaded = await this.minioService.uploadFile(
          file,
          'legal-docs/files',
        );
        fileMetadata = {
          ...uploaded,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        };
      }

      const doc = await this.legalDocModel.create({
        createdBy: new Types.ObjectId(userId),
        categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : null,
        title: dto.title,
        type: dto.type,
        status: LegalDocStatus.DRAFT,
        file: fileMetadata,
        isActive: true,
      });

      const populated = await doc.populate(this.getPopulateQuery());
      const docWithUrl = await this.attachDocFileUrl(populated);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create legal doc successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating legal doc: ${error.message}`,
        content: null,
      };
    }
  }

  async findAll(query: QueryLegalDocDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.status) filter.status = query.status;
      if (query.type) filter.type = new RegExp(query.type, 'i');
      if (query.categoryId)
        filter.categoryId = new Types.ObjectId(query.categoryId);
      if (query.q) {
        const regex = new RegExp(query.q, 'i');
        filter.$or = [{ title: regex }, { type: regex }];
      }

      const [items, total] = await Promise.all([
        this.legalDocModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate(this.getPopulateQuery()),
        this.legalDocModel.countDocuments(filter),
      ]);

      const itemsWithUrls = await this.attachDocListFileUrls(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get legal docs successfully',
        content: {
          items: itemsWithUrls,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting legal docs: ${error.message}`,
        content: null,
      };
    }
  }

  async findPublic(query: QueryLegalDocDto) {
    return this.findAll({ ...query, status: LegalDocStatus.PUBLISHED });
  }

  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid legal doc id',
          content: null,
        };
      }

      const doc = await this.legalDocModel
        .findOne({ _id: new Types.ObjectId(id), isActive: true })
        .populate(this.getPopulateQuery());

      if (!doc) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc not found',
          content: null,
        };
      }

      const docWithUrl = await this.attachDocFileUrl(doc);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get legal doc successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting legal doc: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, userId: string, role: Role, dto: UpdateLegalDocDto) {
    try {
      const { error, doc } = await this.findActiveDocForModify(
        id,
        userId,
        role,
      );
      if (error) return error;

      // Validate new category if provided
      if (dto.categoryId !== undefined) {
        const { error: categoryError } = await this.validateCategory(
          dto.categoryId,
        );
        if (categoryError) return categoryError;
      }

      const updatedDoc = await this.legalDocModel
        .findByIdAndUpdate(
          id,
          {
            ...(dto.categoryId !== undefined && {
              categoryId: dto.categoryId
                ? new Types.ObjectId(dto.categoryId)
                : null,
            }),
            ...(dto.title && { title: dto.title }),
            ...(dto.type && { type: dto.type }),
            ...(dto.status && { status: dto.status }),
          },
          { returnDocument: 'after', runValidators: true },
        )
        .populate(this.getPopulateQuery());

      const docWithUrl = await this.attachDocFileUrl(updatedDoc);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update legal doc successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating legal doc: ${error.message}`,
        content: null,
      };
    }
  }

  async delete(id: string, userId: string, role: Role) {
    try {
      const { error, doc } = await this.findActiveDocForModify(
        id,
        userId,
        role,
      );
      if (error) return error;

      if ((doc as any).file?.objectName) {
        await this.minioService.removeFile((doc as any).file.objectName);
      }

      await this.legalDocModel.findByIdAndUpdate(id, { isActive: false });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete legal doc successfully',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting legal doc: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // PUBLISH / UNPUBLISH
  // =========================

  async publish(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid legal doc id',
          content: null,
        };
      }

      const doc = await this.legalDocModel.findByIdAndUpdate(
        id,
        { status: LegalDocStatus.PUBLISHED },
        { returnDocument: 'after', runValidators: true },
      );

      if (!doc) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Publish legal doc successfully',
        content: { doc },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while publishing legal doc: ${error.message}`,
        content: null,
      };
    }
  }

  async unpublish(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid legal doc id',
          content: null,
        };
      }

      const doc = await this.legalDocModel.findByIdAndUpdate(
        id,
        { status: LegalDocStatus.DRAFT },
        { returnDocument: 'after', runValidators: true },
      );

      if (!doc) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Unpublish legal doc successfully',
        content: { doc },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while unpublishing legal doc: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // FILE UPLOAD / DELETE
  // =========================

  async uploadFile(
    id: string,
    userId: string,
    role: Role,
    file?: Express.Multer.File,
  ) {
    try {
      if (!file) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'File is required',
          content: null,
        };
      }

      if (!ALLOWED_DOC_MIME_TYPES.includes(file.mimetype)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Only PDF, DOC and DOCX files are allowed',
          content: null,
        };
      }

      const { error, doc } = await this.findActiveDocForModify(
        id,
        userId,
        role,
      );
      if (error) return error;

      if ((doc as any).file?.objectName) {
        await this.minioService.removeFile((doc as any).file.objectName);
      }

      const uploadedFile = await this.minioService.uploadFile(
        file,
        'legal-docs/files',
      );

      const fileMetadata = {
        ...uploadedFile,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };

      const updatedDoc = await this.legalDocModel
        .findByIdAndUpdate(
          id,
          { file: fileMetadata },
          { returnDocument: 'after', runValidators: true },
        )
        .populate(this.getPopulateQuery());

      const docWithUrl = await this.attachDocFileUrl(updatedDoc);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Upload legal doc file successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading legal doc file: ${error.message}`,
        content: null,
      };
    }
  }

  async deleteFile(id: string, userId: string, role: Role) {
    try {
      const { error, doc } = await this.findActiveDocForModify(
        id,
        userId,
        role,
      );
      if (error) return error;

      if (!(doc as any).file?.objectName) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'This legal doc has no file attached',
          content: null,
        };
      }

      await this.minioService.removeFile((doc as any).file.objectName);

      const updatedDoc = await this.legalDocModel
        .findByIdAndUpdate(
          id,
          { file: null },
          { returnDocument: 'after', runValidators: true },
        )
        .populate(this.getPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete legal doc file successfully',
        content: { doc: updatedDoc },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting legal doc file: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // STREAM (preview / download)
  // =========================

  async streamFile(
    id: string,
    disposition: 'attachment' | 'inline',
    res: Response,
  ): Promise<StreamableFile | object> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid legal doc id',
          content: null,
        };
      }

      const doc = await this.legalDocModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!doc) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc not found',
          content: null,
        };
      }

      const fileInfo = (doc as any).file;

      if (!fileInfo?.objectName) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'This legal doc has no file attached',
          content: null,
        };
      }

      const fileStream = await this.minioService.getFileStream(
        fileInfo.objectName,
      );
      const encodedName = encodeURIComponent(
        fileInfo.originalName ?? 'document',
      );

      res.setHeader(
        'Content-Type',
        fileInfo.mimeType ?? 'application/octet-stream',
      );
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      );
      if (fileInfo.size) res.setHeader('Content-Length', fileInfo.size);

      return new StreamableFile(fileStream);
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while streaming the file: ${error.message}`,
        content: null,
      };
    }
  }
}
