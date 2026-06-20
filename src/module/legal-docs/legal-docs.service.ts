import { Injectable, StreamableFile } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';
import { LegalDoc, LegalDocStatus } from '../../schema/legal-docs.schema';
import { User } from '../../schema/user.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { Role } from '../../utils/role/role';
import { MinioService } from '../minio/minio.service';
import { CreateLegalDocDto } from './dto/create-legal-docs.req';
import { QueryLegalDocDto } from './dto/query-legal-docs.req';
import { UpdateLegalDocDto } from './dto/update-legal.docs.req';
import { LegalDocsCategory } from '../../schema/legal-docs-category.schema';
import { CreateLegalDocCategoryDto } from './dto/create-legal-docs-category.req';
import { QueryLegalDocCategoryDto } from './dto/query-legal-docs-category.req';
import { UpdateLegalDocCategoryDto } from './dto/update-legal-docs-category.req';
import { CreateTypeCategoryDto } from './dto/create-type-category.req';
import { TypeCategory } from '../../schema/category-type.schema';
import { QueryTypeCategoryDto } from './dto/query-type-category.req';
import { UpdateTypeCategoryDto } from './dto/update-type-category.req';

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

    @InjectModel(LegalDocsCategory.name)
    private readonly legalDocsCategoryModel: Model<LegalDocsCategory>,

    @InjectModel(TypeCategory.name)
    private readonly typeCategoryModel: Model<TypeCategory>,

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
      {
        path: 'createdBy',
        select: 'name email role',
      },
      {
        path: 'categoryId',
        select: 'name slug description typeCategoryId',
        populate: {
          path: 'typeCategoryId',
          select: 'name description',
        },
      },
    ];
  }

  private getTypeCategoryQuery() {
    return [{ path: 'typeCategoryId', select: 'name description' }];
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

  private normalizeVietnamese(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  private slugify(value: string): string {
    return this.normalizeVietnamese(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async generateUniqueLegalDocsSlug(title: string): Promise<string> {
    const baseSlug = this.slugify(title);
    let slug = baseSlug;
    let count = 1;

    while (await this.legalDocModel.exists({ slug })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    return slug;
  }

  private async generateUniqueCategorySlug(name: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let count = 1;

    while (await this.legalDocsCategoryModel.exists({ slug })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    return slug;
  }

  // Validates that categoryId (if provided) refers to an existing, active category.
  // Returns true when categoryId is undefined/null (the field is optional).
  private async ensureCategoryExists(
    categoryId?: string | null,
  ): Promise<boolean> {
    if (!categoryId) return true;
    if (!Types.ObjectId.isValid(categoryId)) return false;

    const exists = await this.legalDocsCategoryModel.exists({
      _id: new Types.ObjectId(categoryId),
      isActive: true,
    });

    return !!exists;
  }

  // =========================
  // TYPE CATEGORY
  // =========================

  async createTypeCategory(createTypeCategoryDto: CreateTypeCategoryDto) {
    try {
      const type = await this.typeCategoryModel.create({
        name: createTypeCategoryDto.name,
        description: createTypeCategoryDto.description ?? null,
        isActive: true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create type category successfully',
        content: {
          type,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Type category slug already exists',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating type category: ${error.message}`,
        content: null,
      };
    }
  }

  async findTypeCategories(query: QueryTypeCategoryDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (query.isActive !== undefined) {
        filter.isActive = query.isActive;
      } else {
        filter.isActive = true;
      }

      if (query.q) {
        const regex = new RegExp(query.q, 'i');

        filter.$or = [{ name: regex }, { slug: regex }, { description: regex }];
      }

      const [items, total] = await Promise.all([
        this.legalDocsCategoryModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.legalDocsCategoryModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get type categories successfully',
        content: {
          items,
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
        message: `There is a problem while getting type categories: ${error.message}`,
        content: null,
      };
    }
  }

  async updateTypeCategory(
    id: string,
    updateTypeCategoryDto: UpdateTypeCategoryDto,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid type category id',
          content: null,
        };
      }

      const existingCategory = await this.typeCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!existingCategory) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Type category not found',
          content: null,
        };
      }

      const updateData: any = {};

      if (updateTypeCategoryDto.name !== undefined) {
        updateData.name = updateTypeCategoryDto.name;

        if (updateTypeCategoryDto.name !== (existingCategory as any).name) {
          updateData.slug = await this.generateUniqueCategorySlug(
            updateTypeCategoryDto.name,
          );
        }
      }

      if (updateTypeCategoryDto.description !== undefined) {
        updateData.description = updateTypeCategoryDto.description;
      }

      const category = await this.typeCategoryModel.findByIdAndUpdate(
        id,
        updateData,
        {
          returnDocument: 'after',
          runValidators: true,
        },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update type category successfully',
        content: {
          category,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating type category: ${error.message}`,
        content: null,
      };
    }
  }

  async deleteTypeCategory(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid type category id',
          content: null,
        };
      }

      const category = await this.typeCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Types category not found',
          content: null,
        };
      }

      const hasDocsCategory = await this.legalDocsCategoryModel.exists({
        categoryId: new Types.ObjectId(id),
        isActive: true,
      });

      if (hasDocsCategory) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'Cannot delete category because it is being used by legal docs',
          content: null,
        };
      }

      const deletedTypeCategory =
        await this.typeCategoryModel.findByIdAndUpdate(
          id,
          {
            isActive: false,
          },
          {
            returnDocument: 'after',
          },
        );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete type category successfully',
        content: {
          category: deletedTypeCategory,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting type category: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // LEGAL DOC CATEGORY
  // =========================

  async createCategory(createLegalDocCategoryDto: CreateLegalDocCategoryDto) {
    try {
      const slug = await this.generateUniqueCategorySlug(
        createLegalDocCategoryDto.name,
      );

      const category = await this.legalDocsCategoryModel.create({
        title: createLegalDocCategoryDto.title,
        name: createLegalDocCategoryDto.name,
        slug,
        description: createLegalDocCategoryDto.description ?? null,
        typeCategoryId: createLegalDocCategoryDto.typeId,
        isActive: true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create legal doc category successfully',
        content: {
          category,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc category slug already exists',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating legal doc category: ${error.message}`,
        content: null,
      };
    }
  }

  async findCategories(query: QueryLegalDocCategoryDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (query.isActive !== undefined) {
        filter.isActive = query.isActive;
      } else {
        filter.isActive = true;
      }

      if (query.q) {
        const regex = new RegExp(query.q, 'i');

        filter.$or = [{ name: regex }, { slug: regex }, { description: regex }];
      }

      const [items, total] = await Promise.all([
        this.legalDocsCategoryModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate(this.getTypeCategoryQuery()),
        this.legalDocsCategoryModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get legal doc categories successfully',
        content: {
          items,
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
        message: `There is a problem while getting legal doc categories: ${error.message}`,
        content: null,
      };
    }
  }

  async updateCategory(
    id: string,
    updateLegalDocCategoryDto: UpdateLegalDocCategoryDto,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid category id',
          content: null,
        };
      }

      const existingCategory = await this.legalDocsCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!existingCategory) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc category not found',
          content: null,
        };
      }

      const updateData: any = {};

      if (updateLegalDocCategoryDto.name !== undefined) {
        updateData.name = updateLegalDocCategoryDto.name;

        if (updateLegalDocCategoryDto.name !== (existingCategory as any).name) {
          updateData.slug = await this.generateUniqueCategorySlug(
            updateLegalDocCategoryDto.name,
          );
        }
      }

      if (updateLegalDocCategoryDto.description !== undefined) {
        updateData.description = updateLegalDocCategoryDto.description;
      }

      const category = await this.legalDocsCategoryModel.findByIdAndUpdate(
        id,
        updateData,
        {
          returnDocument: 'after',
          runValidators: true,
        },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update legal doc category successfully',
        content: {
          category,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc category slug already exists',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating legal doc category: ${error.message}`,
        content: null,
      };
    }
  }

  async deleteCategory(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid category id',
          content: null,
        };
      }

      const category = await this.legalDocsCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc category not found',
          content: null,
        };
      }

      const hasLegalDocs = await this.legalDocModel.exists({
        categoryId: new Types.ObjectId(id),
        isActive: true,
      });

      if (hasLegalDocs) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'Cannot delete category because it is being used by legal docs',
          content: null,
        };
      }

      const deletedCategory =
        await this.legalDocsCategoryModel.findByIdAndUpdate(
          id,
          {
            isActive: false,
          },
          {
            returnDocument: 'after',
          },
        );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete legal doc category successfully',
        content: {
          category: deletedCategory,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting legal doc category: ${error.message}`,
        content: null,
      };
    }
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
      if (!(await this.ensureCategoryExists(dto.categoryId))) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc category not found',
          content: null,
        };
      }

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

      if (
        dto.categoryId !== undefined &&
        dto.categoryId !== null &&
        dto.categoryId !== '' &&
        !(await this.ensureCategoryExists(dto.categoryId))
      ) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Legal doc category not found',
          content: null,
        };
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
