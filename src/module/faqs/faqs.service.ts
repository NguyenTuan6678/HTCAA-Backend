import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFaqDto } from './dto/create-faq.req';
import { UpdateFaqDto } from './dto/update-faq.req';
import { QueryFaqDto } from './dto/query-faq.req';
import { CreateFaqCategoryDto } from './dto/create-faq-category.req';
import { UpdateFaqCategoryDto } from './dto/update-faq-category.req';
import { QueryFaqCategoryDto } from './dto/query-faq-category.req';
import { ERROR_RES, ERROR_INFO } from '../../constants/error.const';
import { Faq, FaqStatus } from '../../schema/faqs.schema';
import { FaqCategory } from '../../schema/faq-category.schema';
import { Role } from '../../utils/role/role';

@Injectable()
export class FaqsService {
  constructor(
    @InjectModel(Faq.name)
    private readonly faqModel: Model<Faq>,
    @InjectModel(FaqCategory.name)
    private readonly faqCategoryModel: Model<FaqCategory>,
  ) {}

  // =========================
  // HELPERS
  // =========================

  private getPopulateQuery() {
    return [
      { path: 'createdBy', select: 'name email role' },
      { path: 'categoryId', select: 'title name slug description' },
    ];
  }

  private async findActiveById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return {
        error: {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid FAQ id',
          content: null,
        },
        faq: null,
      };
    }

    const faq = await this.faqModel.findOne({
      _id: new Types.ObjectId(id),
      isActive: true,
    });

    if (!faq) {
      return {
        error: {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'FAQ not found',
          content: null,
        },
        faq: null,
      };
    }

    return { error: null, faq };
  }

  private canModify(faq: any, userId: string, role: Role): boolean {
    if (role === Role.ADMIN) return true;
    return faq.createdBy?.toString() === userId;
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

  private async generateUniqueCategorySlug(title: string): Promise<string> {
    const baseSlug = this.slugify(title);
    let slug = baseSlug;
    let count = 1;

    while (await this.faqCategoryModel.exists({ slug })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    return slug;
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

    const category = await this.faqCategoryModel.findOne({
      _id: new Types.ObjectId(categoryId),
      isActive: true,
    });

    if (!category) {
      return {
        error: {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'FAQ Category not found or inactive',
          content: null,
        },
      };
    }

    return { error: null };
  }

  // =========================
  // CRUD
  // =========================

  async create(userId: string, dto: CreateFaqDto) {
    try {
      const { error: categoryError } = await this.validateCategory(dto.categoryId);
      if (categoryError) return categoryError;

      const faq = await this.faqModel.create({
        createdBy: new Types.ObjectId(userId),
        categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : null,
        question: dto.question,
        answer: dto.answer,
        status: FaqStatus.DRAFT,
        likes: 0,
        dislikes: 0,
        likedBy: [],
        dislikedBy: [],
        isActive: true,
      });

      const populated = await faq.populate(this.getPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create FAQ successfully',
        content: { faq: populated },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating FAQ: ${error.message}`,
        content: null,
      };
    }
  }

  /** Admin/Editor – list all FAQs with any status */
  async findAll(query: QueryFaqDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.status) filter.status = query.status;
      if (query.categoryId) {
        if (Types.ObjectId.isValid(query.categoryId)) {
          filter.categoryId = new Types.ObjectId(query.categoryId);
        } else {
          filter.categoryId = null;
        }
      }
      if (query.q) {
        const regex = new RegExp(query.q, 'i');
        filter.$or = [{ question: regex }, { answer: regex }];
      }

      const [items, total] = await Promise.all([
        this.faqModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate(this.getPopulateQuery())
          .select('-likedBy -dislikedBy'), // don't leak user id arrays
        this.faqModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get FAQs successfully',
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
        message: `There is a problem while getting FAQs: ${error.message}`,
        content: null,
      };
    }
  }

  /** Public – list only Published FAQs */
  async findPublic(query: QueryFaqDto) {
    return this.findAll({ ...query, status: FaqStatus.PUBLISHED });
  }

  async findOne(id: string) {
    try {
      const { error, faq } = await this.findActiveById(id);
      if (error) return error;

      const populated = await faq!.populate(this.getPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get FAQ successfully',
        content: { faq: populated },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting FAQ: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, userId: string, role: Role, dto: UpdateFaqDto) {
    try {
      const { error, faq } = await this.findActiveById(id);
      if (error) return error;

      if (!this.canModify(faq, userId, role)) {
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to modify this FAQ',
          content: null,
        };
      }

      if (dto.categoryId !== undefined) {
        const { error: categoryError } = await this.validateCategory(dto.categoryId);
        if (categoryError) return categoryError;
      }

      const updated = await this.faqModel
        .findByIdAndUpdate(
          id,
          {
            ...(dto.categoryId !== undefined && {
              categoryId: dto.categoryId
                ? new Types.ObjectId(dto.categoryId)
                : null,
            }),
            ...(dto.question && { question: dto.question }),
            ...(dto.answer && { answer: dto.answer }),
          },
          { returnDocument: 'after', runValidators: true },
        )
        .populate(this.getPopulateQuery())
        .select('-likedBy -dislikedBy');

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update FAQ successfully',
        content: { faq: updated },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating FAQ: ${error.message}`,
        content: null,
      };
    }
  }

  async delete(id: string, userId: string, role: Role) {
    try {
      const { error, faq } = await this.findActiveById(id);
      if (error) return error;

      if (!this.canModify(faq, userId, role)) {
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to delete this FAQ',
          content: null,
        };
      }

      await this.faqModel.findByIdAndUpdate(id, { isActive: false });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete FAQ successfully',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting FAQ: ${error.message}`,
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
          message: 'Invalid FAQ id',
          content: null,
        };
      }

      const faq = await this.faqModel.findByIdAndUpdate(
        id,
        { status: FaqStatus.PUBLISHED },
        { returnDocument: 'after' },
      );

      if (!faq) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'FAQ not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Publish FAQ successfully',
        content: { faq },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while publishing FAQ: ${error.message}`,
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
          message: 'Invalid FAQ id',
          content: null,
        };
      }

      const faq = await this.faqModel.findByIdAndUpdate(
        id,
        { status: FaqStatus.DRAFT },
        { returnDocument: 'after' },
      );

      if (!faq) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'FAQ not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Unpublish FAQ successfully',
        content: { faq },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while unpublishing FAQ: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // LIKES / DISLIKES
  // =========================

  /**
   * Toggle like on a FAQ for a logged-in user.
   * - If user already liked → remove the like (unlike)
   * - If user already disliked → remove dislike first, then add like
   * - Otherwise → add like
   */
  async like(id: string, userId: string) {
    try {
      const { error, faq } = await this.findActiveById(id);
      if (error) return error;

      const userObjectId = new Types.ObjectId(userId);
      const alreadyLiked = faq!.likedBy.some((uid) => uid.equals(userObjectId));
      const alreadyDisliked = faq!.dislikedBy.some((uid) =>
        uid.equals(userObjectId),
      );

      let update: any;

      if (alreadyLiked) {
        // Unlike
        update = {
          $pull: { likedBy: userObjectId },
          $inc: { likes: -1 },
        };
      } else if (alreadyDisliked) {
        // Switch from dislike to like
        update = {
          $pull: { dislikedBy: userObjectId },
          $push: { likedBy: userObjectId },
          $inc: { likes: 1, dislikes: -1 },
        };
      } else {
        // New like
        update = {
          $push: { likedBy: userObjectId },
          $inc: { likes: 1 },
        };
      }

      const updated = await this.faqModel
        .findByIdAndUpdate(id, update, { returnDocument: 'after' })
        .select('-likedBy -dislikedBy');

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: alreadyLiked ? 'Unliked FAQ' : 'Liked FAQ',
        content: { faq: updated },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while liking FAQ: ${error.message}`,
        content: null,
      };
    }
  }

  /**
   * Toggle dislike on a FAQ for a logged-in user.
   * - If user already disliked → remove the dislike (un-dislike)
   * - If user already liked → remove like first, then add dislike
   * - Otherwise → add dislike
   */
  async dislike(id: string, userId: string) {
    try {
      const { error, faq } = await this.findActiveById(id);
      if (error) return error;

      const userObjectId = new Types.ObjectId(userId);
      const alreadyLiked = faq!.likedBy.some((uid) => uid.equals(userObjectId));
      const alreadyDisliked = faq!.dislikedBy.some((uid) =>
        uid.equals(userObjectId),
      );

      let update: any;

      if (alreadyDisliked) {
        // Un-dislike
        update = {
          $pull: { dislikedBy: userObjectId },
          $inc: { dislikes: -1 },
        };
      } else if (alreadyLiked) {
        // Switch from like to dislike
        update = {
          $pull: { likedBy: userObjectId },
          $push: { dislikedBy: userObjectId },
          $inc: { likes: -1, dislikes: 1 },
        };
      } else {
        // New dislike
        update = {
          $push: { dislikedBy: userObjectId },
          $inc: { dislikes: 1 },
        };
      }

      const updated = await this.faqModel
        .findByIdAndUpdate(id, update, { returnDocument: 'after' })
        .select('-likedBy -dislikedBy');

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: alreadyDisliked ? 'Un-disliked FAQ' : 'Disliked FAQ',
        content: { faq: updated },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while disliking FAQ: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // FAQ CATEGORY CRUD
  // =========================

  async createCategory(dto: CreateFaqCategoryDto) {
    try {
      const slug = await this.generateUniqueCategorySlug(dto.title);
      const category = await this.faqCategoryModel.create({
        title: dto.title,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        isActive: true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create FAQ category successfully',
        content: { category },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Category title or slug already exists',
          content: null,
        };
      }
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating FAQ category: ${error.message}`,
        content: null,
      };
    }
  }

  async findCategories(query: QueryFaqCategoryDto) {
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
        filter.$or = [{ title: regex }, { name: regex }];
      }

      const [items, total] = await Promise.all([
        this.faqCategoryModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.faqCategoryModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get FAQ categories successfully',
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
        message: `There is a problem while getting FAQ categories: ${error.message}`,
        content: null,
      };
    }
  }

  async updateCategory(id: string, dto: UpdateFaqCategoryDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid category id',
          content: null,
        };
      }

      const category = await this.faqCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'FAQ category not found',
          content: null,
        };
      }

      const updateData: any = {};
      if (dto.title !== undefined) {
        updateData.title = dto.title;
        if (dto.title !== (category as any).title) {
          updateData.slug = await this.generateUniqueCategorySlug(dto.title);
        }
      }
      if (dto.name !== undefined) {
        updateData.name = dto.name;
      }
      if (dto.description !== undefined) {
        updateData.description = dto.description ?? null;
      }
      if (dto.isActive !== undefined) {
        updateData.isActive = dto.isActive;
      }

      const updated = await this.faqCategoryModel.findByIdAndUpdate(
        id,
        updateData,
        { returnDocument: 'after', runValidators: true },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update FAQ category successfully',
        content: { category: updated },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Category title or slug already exists',
          content: null,
        };
      }
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating FAQ category: ${error.message}`,
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

      const category = await this.faqCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'FAQ category not found',
          content: null,
        };
      }

      const hasFaqs = await this.faqModel.exists({
        categoryId: new Types.ObjectId(id),
        isActive: true,
      });

      if (hasFaqs) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Cannot delete category because it is being used by FAQs',
          content: null,
        };
      }

      const deleted = await this.faqCategoryModel.findByIdAndUpdate(
        id,
        { isActive: false },
        { returnDocument: 'after' },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete FAQ category successfully',
        content: { category: deleted },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting FAQ category: ${error.message}`,
        content: null,
      };
    }
  }
}
