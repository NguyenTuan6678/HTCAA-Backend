import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';

import { CreateDocumentDto } from './dto/create-document.req';
import { UpdateDocumentDto } from './dto/update-document.req';
import { QueryDocumentDto } from './dto/query-document.req';
import { ERROR_RES, ERROR_INFO } from '../../constants/error.const';
import { MinioService } from '../minio/minio.service';
import { DocumentFile, DocumentStatus } from '../../schema/documents.schema';
import { LegalDocsCategory } from '../../schema/legal-docs-category.schema';
import { Role } from '../../utils/role.enum';
import { escapeRegex } from '../../utils/escape-regex';

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',
];

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(DocumentFile.name)
    private readonly documentModel: Model<DocumentFile>,

    @InjectModel(LegalDocsCategory.name)
    private readonly legalDocsCategoryModel: Model<LegalDocsCategory>,

    private readonly minioService: MinioService,
  ) { }

  // ───  HELPERS ────────────────────────────────────────────────────────────────

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
          message: 'Invalid document id',
          content: null,
        },
        doc: null,
      };
    }

    const doc = await this.documentModel.findOne({
      _id: new Types.ObjectId(id),
      isActive: true,
    });

    if (!doc) {
      return {
        error: {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Document not found',
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
      { path: 'categoryId', select: 'name slug description' },
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

    const category = await this.legalDocsCategoryModel.findOne({
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

  // ─── ADMIN  ────────────────────────────────────────────────────────────────

  async create(
    userId: string,
    dto: CreateDocumentDto,
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

      const mimeType = file.mimetype;
      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Only .xlsx and .xls files are allowed',
          content: null,
        };
      }

      const { error: categoryError } = await this.validateCategory(
        dto.categoryId,
      );
      if (categoryError) return categoryError;

      const result = await this.minioService.uploadFile(
        file,
        'legal-docs/files',
      );

      const fileMetadata = {
        objectName: result.objectName,
        originalName: result.originalName,
        mimeType: result.mimetype,
        size: result.size,
      };

      const doc = await this.documentModel.create({
        createdBy: new Types.ObjectId(userId),
        categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : null,
        title: dto.title,
        description: dto.description,
        status: DocumentStatus.DRAFT,
        file: fileMetadata,
        isActive: true,
      });

      const populated = await doc.populate(this.getPopulateQuery());
      const docWithUrl = await this.attachDocFileUrl(populated);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create document successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating document: ${error.message}`,
        content: null,
      };
    }
  }

  async findAll(query: QueryDocumentDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.status) filter.status = query.status;
      if (query.categoryId)
        filter.categoryId = new Types.ObjectId(query.categoryId);
      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');
        filter.$or = [{ title: regex }, { description: regex }];
      }

      const [items, total] = await Promise.all([
        this.documentModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate(this.getPopulateQuery()),
        this.documentModel.countDocuments(filter),
      ]);

      const itemsWithUrls = await this.attachDocListFileUrls(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get documents successfully',
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
        message: `There is a problem while getting documents: ${error.message}`,
        content: null,
      };
    }
  }

  async findPublic(query: QueryDocumentDto) {
    return this.findAll({ ...query, status: DocumentStatus.PUBLISHED });
  }

  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid document id',
          content: null,
        };
      }

      const doc = await this.documentModel
        .findOne({ _id: new Types.ObjectId(id), isActive: true })
        .populate(this.getPopulateQuery());

      if (!doc) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Document not found',
          content: null,
        };
      }

      const docWithUrl = await this.attachDocFileUrl(doc);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get document successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting document: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, userId: string, role: Role, dto: UpdateDocumentDto) {
    try {
      const { error, doc } = await this.findActiveDocForModify(
        id,
        userId,
        role,
      );
      if (error) return error;

      if (dto.categoryId !== undefined) {
        const { error: categoryError } = await this.validateCategory(
          dto.categoryId,
        );
        if (categoryError) return categoryError;
      }

      const updatedDoc = await this.documentModel
        .findByIdAndUpdate(
          id,
          {
            ...(dto.categoryId !== undefined && {
              categoryId: dto.categoryId
                ? new Types.ObjectId(dto.categoryId)
                : null,
            }),
            ...(dto.title && { title: dto.title }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.status && { status: dto.status }),
          },
          { returnDocument: 'after', runValidators: true },
        )
        .populate(this.getPopulateQuery());

      const docWithUrl = await this.attachDocFileUrl(updatedDoc);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update document successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating document: ${error.message}`,
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

      await this.documentModel.findByIdAndDelete(id);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete document successfully',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting document: ${error.message}`,
        content: null,
      };
    }
  }

  // ─── PUBLISH / UNPUBLISH ────────────────────────────────────────────────────────────────

  async publish(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid document id',
          content: null,
        };
      }

      const doc = await this.documentModel.findByIdAndUpdate(
        id,
        { status: DocumentStatus.PUBLISHED },
        { returnDocument: 'after' },
      );

      if (!doc) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Document not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Publish document successfully',
        content: { doc },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while publishing document: ${error.message}`,
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
          message: 'Invalid document id',
          content: null,
        };
      }

      const doc = await this.documentModel.findByIdAndUpdate(
        id,
        { status: DocumentStatus.DRAFT },
        { returnDocument: 'after' },
      );

      if (!doc) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Document not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Unpublish document successfully',
        content: { doc },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while unpublishing document: ${error.message}`,
        content: null,
      };
    }
  }

  // ─── FILE REPLACE / DELETE ────────────────────────────────────────────────────────────────

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

      const mimeType = file.mimetype;
      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Only .xlsx and .xls files are allowed',
          content: null,
        };
      }

      const { error, doc } = await this.findActiveDocForModify(
        id,
        userId,
        role,
      );
      if (error) return error;

      const result = await this.minioService.uploadFile(
        file,
        'legal-docs/files',
      );

      if ((doc as any).file?.objectName) {
        await this.minioService.removeFile((doc as any).file.objectName);
      }

      const fileMetadata = {
        objectName: result.objectName,
        originalName: result.originalName,
        mimeType: result.mimetype,
        size: result.size,
      };

      const updatedDoc = await this.documentModel
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
        message: 'Replace document file successfully',
        content: { doc: docWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while replacing document file: ${error.message}`,
        content: null,
      };
    }
  }

  // ─── DOWNLOAD (stream) ────────────────────────────────────────────────────────────────

  async downloadFile(id: string, res: Response): Promise<StreamableFile> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid document id');
      }

      const doc = await this.documentModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!doc) {
        throw new NotFoundException('Document not found');
      }

      const fileInfo = (doc as any).file;

      if (!fileInfo?.objectName) {
        throw new NotFoundException('This document has no file attached');
      }

      const fileStream = await this.minioService.getFileStream(
        fileInfo.objectName,
      );
      const encodedName = encodeURIComponent(
        fileInfo.originalName ?? 'document.xlsx',
      );

      res.setHeader(
        'Content-Type',
        fileInfo.mimeType ??
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      );
      if (fileInfo.size) res.setHeader('Content-Length', fileInfo.size);

      return new StreamableFile(fileStream);
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while downloading the file: ${error.message}`,
      );
    }
  }
}
