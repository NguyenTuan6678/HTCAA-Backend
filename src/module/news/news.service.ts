import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { News } from '../../schema/news.schema';
import { NewsCategory } from '../../schema/news-category.schema';
import { User } from '../../schema/user.schema';

import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { Role } from '../../utils/role/role';

import { CreateNewsDto } from './dto/create-news.req';
import { UpdateNewsDto } from './dto/update-news.req';
import { QueryNewsDto } from './dto/query-news.req';
import { QueryAdminNewsDto } from './dto/query-admin-news.req';

import { CreateNewsCategoryDto } from './dto/create-news-category.req';
import { UpdateNewsCategoryDto } from './dto/update-news-category.req';
import { QueryNewsCategoryDto } from './dto/query-news-category.req';
import { NewsStatus } from '../../utils/new-status.enum';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name)
    private readonly newsModel: Model<News>,

    @InjectModel(NewsCategory.name)
    private readonly newsCategoryModel: Model<NewsCategory>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  // =========================
  // HELPERS
  // =========================

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

  private async generateUniqueNewsSlug(title: string): Promise<string> {
    const baseSlug = this.slugify(title);
    let slug = baseSlug;
    let count = 1;

    while (await this.newsModel.exists({ slug })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    return slug;
  }

  private async generateUniqueCategorySlug(name: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let count = 1;

    while (await this.newsCategoryModel.exists({ slug })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    return slug;
  }

  private canModify(news: any, userId: string, role: Role): boolean {
    if (role === Role.ADMIN) {
      return true;
    }

    return news.createdBy?.toString() === userId;
  }

  private async ensureCategoryExists(categoryId: string) {
    if (!Types.ObjectId.isValid(categoryId)) {
      return null;
    }

    return this.newsCategoryModel.findOne({
      _id: new Types.ObjectId(categoryId),
      isActive: true,
    });
  }

  private async applyCategoryFilter(
    filter: any,
    categoryId?: string,
    categorySlug?: string,
  ) {
    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) {
        filter.categoryId = null;
        return;
      }

      filter.categoryId = new Types.ObjectId(categoryId);
      return;
    }

    if (categorySlug) {
      const category = await this.newsCategoryModel.findOne({
        slug: categorySlug,
        isActive: true,
      });

      if (!category) {
        filter.categoryId = null;
        return;
      }

      filter.categoryId = category._id;
    }
  }

  private getNewsPopulateQuery() {
    return [
      {
        path: 'createdBy',
        select: 'name email role',
      },
      {
        path: 'categoryId',
        select: 'name slug description isActive',
      },
    ];
  }

  // =========================
  // NEWS CATEGORY
  // =========================

  async createCategory(createCategoryDto: CreateNewsCategoryDto) {
    try {
      const slug = await this.generateUniqueCategorySlug(
        createCategoryDto.name,
      );

      const category = await this.newsCategoryModel.create({
        name: createCategoryDto.name,
        slug,
        description: createCategoryDto.description ?? null,
        isActive: true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create news category successfully',
        content: {
          category,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News category slug already exists',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating news category: ${error.message}`,
        content: null,
      };
    }
  }

  async findCategories(query: QueryNewsCategoryDto) {
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
        this.newsCategoryModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.newsCategoryModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get news categories successfully',
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
        message: `There is a problem while getting news categories: ${error.message}`,
        content: null,
      };
    }
  }

  async updateCategory(id: string, updateCategoryDto: UpdateNewsCategoryDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid category id',
          content: null,
        };
      }

      const existingCategory = await this.newsCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!existingCategory) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News category not found',
          content: null,
        };
      }

      const updateData: any = {};

      if (updateCategoryDto.name !== undefined) {
        updateData.name = updateCategoryDto.name;

        if (updateCategoryDto.name !== (existingCategory as any).name) {
          updateData.slug = await this.generateUniqueCategorySlug(
            updateCategoryDto.name,
          );
        }
      }

      if (updateCategoryDto.description !== undefined) {
        updateData.description = updateCategoryDto.description;
      }

      const category = await this.newsCategoryModel.findByIdAndUpdate(
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
        message: 'Update news category successfully',
        content: {
          category,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News category slug already exists',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating news category: ${error.message}`,
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

      const category = await this.newsCategoryModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News category not found',
          content: null,
        };
      }

      const hasNews = await this.newsModel.exists({
        categoryId: new Types.ObjectId(id),
        isActive: true,
      });

      if (hasNews) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Cannot delete category because it is being used by news',
          content: null,
        };
      }

      const deletedCategory = await this.newsCategoryModel.findByIdAndUpdate(
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
        message: 'Delete news category successfully',
        content: {
          category: deletedCategory,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting news category: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // NEWS
  // =========================

  async create(userId: string, createNewsDto: CreateNewsDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      const user = await this.userModel.findById(userId);

      if (!user || !(user as any).isActive) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found or inactive',
          content: null,
        };
      }

      const category = await this.ensureCategoryExists(
        createNewsDto.categoryId,
      );

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News category not found',
          content: null,
        };
      }

      const slug = await this.generateUniqueNewsSlug(createNewsDto.title);

      const news = await this.newsModel.create({
        createdBy: new Types.ObjectId(userId),
        categoryId: new Types.ObjectId(createNewsDto.categoryId),
        title: createNewsDto.title,
        slug,
        summary: createNewsDto.summary ?? null,
        content: createNewsDto.content ?? null,
        tags: createNewsDto.tags ?? [],
        isFeatured: createNewsDto.isFeatured ?? false,
        status: NewsStatus.DRAFT,
        publishedAt: null,
        viewCount: 0,
        isActive: true,
      });

      const populatedNews = await this.newsModel
        .findById(news._id)
        .populate(this.getNewsPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create news successfully',
        content: {
          news: populatedNews,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News slug already exists',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating news: ${error.message}`,
        content: null,
      };
    }
  }

  async findPublic(query: QueryNewsDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const skip = (page - 1) * limit;

      const filter: any = {
        isActive: true,
        status: NewsStatus.PUBLISHED,
      };

      await this.applyCategoryFilter(
        filter,
        query.categoryId,
        query.categorySlug,
      );

      if (query.isFeatured !== undefined) {
        filter.isFeatured = query.isFeatured;
      }

      if (query.tag) {
        filter.tags = query.tag;
      }

      if (query.q) {
        const regex = new RegExp(query.q, 'i');

        filter.$or = [
          { title: regex },
          { slug: regex },
          { summary: regex },
          { content: regex },
          { tags: regex },
        ];
      }

      const [items, total] = await Promise.all([
        this.newsModel
          .find(filter)
          .populate(this.getNewsPopulateQuery())
          .sort({ publishedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.newsModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get news list successfully',
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
        message: `There is a problem while getting news list: ${error.message}`,
        content: null,
      };
    }
  }

  async findAdmin(query: QueryAdminNewsDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = {
        isActive: true,
      };

      await this.applyCategoryFilter(
        filter,
        query.categoryId,
        query.categorySlug,
      );

      if (query.status) {
        filter.status = query.status;
      }

      if (query.q) {
        const regex = new RegExp(query.q, 'i');

        filter.$or = [
          { title: regex },
          { slug: regex },
          { summary: regex },
          { content: regex },
          { tags: regex },
        ];
      }

      const [items, total] = await Promise.all([
        this.newsModel
          .find(filter)
          .populate(this.getNewsPopulateQuery())
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.newsModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get admin news list successfully',
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
        message: `There is a problem while getting admin news list: ${error.message}`,
        content: null,
      };
    }
  }

  async findBySlug(slug: string) {
    try {
      const news = await this.newsModel
        .findOneAndUpdate(
          {
            slug,
            isActive: true,
            status: NewsStatus.PUBLISHED,
          },
          {
            $inc: { viewCount: 1 },
          },
          {
            returnDocument: 'after',
          },
        )
        .populate(this.getNewsPopulateQuery());

      if (!news) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get news detail successfully',
        content: {
          news,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting news detail: ${error.message}`,
        content: null,
      };
    }
  }

  async update(
    id: string,
    userId: string,
    role: Role,
    updateNewsDto: UpdateNewsDto,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid news id',
          content: null,
        };
      }

      const news = await this.newsModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!news) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News not found',
          content: null,
        };
      }

      if (!this.canModify(news, userId, role)) {
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to update this news',
          content: null,
        };
      }

      const updateData: any = {};

      if (updateNewsDto.categoryId !== undefined) {
        const category = await this.ensureCategoryExists(
          updateNewsDto.categoryId,
        );

        if (!category) {
          return {
            code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
            info: ERROR_INFO.FAIL,
            message: 'News category not found',
            content: null,
          };
        }

        updateData.categoryId = new Types.ObjectId(updateNewsDto.categoryId);
      }

      if (updateNewsDto.title !== undefined) {
        updateData.title = updateNewsDto.title;

        if (updateNewsDto.title !== (news as any).title) {
          updateData.slug = await this.generateUniqueNewsSlug(
            updateNewsDto.title,
          );
        }
      }

      if (updateNewsDto.summary !== undefined) {
        updateData.summary = updateNewsDto.summary;
      }

      if (updateNewsDto.content !== undefined) {
        updateData.content = updateNewsDto.content;
      }

      if (updateNewsDto.tags !== undefined) {
        updateData.tags = updateNewsDto.tags;
      }

      if (updateNewsDto.isFeatured !== undefined) {
        updateData.isFeatured = updateNewsDto.isFeatured;
      }

      const updatedNews = await this.newsModel
        .findByIdAndUpdate(id, updateData, {
          returnDocument: 'after',
          runValidators: true,
        })
        .populate(this.getNewsPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update news successfully',
        content: {
          news: updatedNews,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News slug already exists',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating news: ${error.message}`,
        content: null,
      };
    }
  }

  async publish(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid news id',
          content: null,
        };
      }

      const news = await this.newsModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
            isActive: true,
          },
          {
            status: NewsStatus.PUBLISHED,
            publishedAt: new Date(),
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate(this.getNewsPopulateQuery());

      if (!news) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Publish news successfully',
        content: {
          news,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while publishing news: ${error.message}`,
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
          message: 'Invalid news id',
          content: null,
        };
      }

      const news = await this.newsModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
            isActive: true,
          },
          {
            status: NewsStatus.DRAFT,
            publishedAt: null,
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate(this.getNewsPopulateQuery());

      if (!news) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Unpublish news successfully',
        content: {
          news,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while unpublishing news: ${error.message}`,
        content: null,
      };
    }
  }

  async delete(id: string, userId: string, role: Role) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid news id',
          content: null,
        };
      }

      const news = await this.newsModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!news) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News not found',
          content: null,
        };
      }

      if (!this.canModify(news, userId, role)) {
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to delete this news',
          content: null,
        };
      }

      const deletedNews = await this.newsModel
        .findByIdAndUpdate(
          id,
          {
            isActive: false,
          },
          {
            returnDocument: 'after',
          },
        )
        .populate(this.getNewsPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete news successfully',
        content: {
          news: deletedNews,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting news: ${error.message}`,
        content: null,
      };
    }
  }
}
