import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFaqDto } from './dto/create-faq.req';
import { UpdateFaqDto } from './dto/update-faq.req';
import { QueryFaqDto } from './dto/query-faq.req';
import { ERROR_RES, ERROR_INFO } from '../../constants/error.const';
import { Faq, FaqStatus } from '../../schema/faqs.schema';
import { Role } from '../../utils/role/role';

@Injectable()
export class FaqsService {
  constructor(
    @InjectModel(Faq.name)
    private readonly faqModel: Model<Faq>,
  ) {}

  // =========================
  // HELPERS
  // =========================

  private getPopulateQuery() {
    return [
      { path: 'createdBy', select: 'name email role' },
      { path: 'categoryId', select: 'name slug description' },
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

  // =========================
  // CRUD
  // =========================

  async create(userId: string, dto: CreateFaqDto) {
    try {
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
}
