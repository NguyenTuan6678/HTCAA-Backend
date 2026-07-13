import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { News } from '../../schema/news.schema';
import { NewsCategory } from '../../schema/news-category.schema';
import { User } from '../../schema/user.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { Role } from '../../utils/role.enum';
import { CreateNewsDto } from './dto/create-news.req';
import { UpdateNewsDto } from './dto/update-news.req';
import { QueryNewsDto } from './dto/query-news.req';
import { QueryAdminNewsDto } from './dto/query-admin-news.req';
import { CreateNewsCategoryDto } from './dto/create-news-category.req';
import { UpdateNewsCategoryDto } from './dto/update-news-category.req';
import { QueryNewsCategoryDto } from './dto/query-news-category.req';
import { NewsStatus } from '../../utils/new-status.enum';
import { NewsComment } from '../../schema/news-comment.schema';
import { CreateNewsCommentDto } from './dto/create-news-comment.req';
import { QueryNewsCommentDto } from './dto/query-news-comment.req';
import { UpdateNewsCommentDto } from './dto/update-news-comment.req';
import { MinioService } from '../minio/minio.service';
import { escapeRegex } from '../../utils/escape-regex';
import { MailService } from '../mail/mail.service';
import { NewsletterSubscriberService } from '../newsletter-subscriber/newsletter-subscriber.service';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name)
    private readonly newsModel: Model<News>,

    @InjectModel(NewsCategory.name)
    private readonly newsCategoryModel: Model<NewsCategory>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    @InjectModel(NewsComment.name)
    private readonly newsCommentModel: Model<NewsComment>,

    private readonly minioService: MinioService,
    private readonly mailService: MailService,
    private readonly newsletterSubscriberService: NewsletterSubscriberService,
  ) {}

  // ─── HELPERS  ────────────────────────────────────────────────────────────────

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

  private async findActiveNewsForModify(
    id: string,
    userId: string,
    role: Role,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      return {
        error: {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid news id',
          content: null,
        },
        news: null,
      };
    }

    const news = await this.newsModel.findOne({
      _id: new Types.ObjectId(id),
      isActive: true,
    });

    if (!news) {
      return {
        error: {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News not found',
          content: null,
        },
        news: null,
      };
    }

    if (!this.canModify(news, userId, role)) {
      return {
        error: {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to modify this news',
          content: null,
        },
        news: null,
      };
    }

    return {
      error: null,
      news,
    };
  }

  private async attachNewsFileUrls(news: any) {
    if (!news) return news;

    const newsObject =
      typeof news.toObject === 'function' ? news.toObject() : news;

    if (newsObject.thumbnail?.objectName) {
      newsObject.thumbnail = await this.minioService.attachPresignedUrl(
        newsObject.thumbnail,
      );
    }

    if (Array.isArray(newsObject.images)) {
      newsObject.images = await Promise.all(
        newsObject.images.map((image: any) =>
          this.minioService.attachPresignedUrl(image),
        ),
      );
    }

    return newsObject;
  }

  private async attachNewsListFileUrls(newsList: any[]) {
    return Promise.all(newsList.map((news) => this.attachNewsFileUrls(news)));
  }

  private async notifySubscribersOfPublishedNews(news: any) {
    try {
      const emails =
        await this.newsletterSubscriberService.findConfirmedEmails();

      if (emails.length === 0) {
        return;
      }

      const newsWithUrls = await this.attachNewsFileUrls(news);

      const { sent, failed } =
        await this.mailService.sendNewsNotificationEmails(emails, {
          title: newsWithUrls.title,
          slug: newsWithUrls.slug,
          summary: newsWithUrls.summary ?? null,
          thumbnailUrl: newsWithUrls.thumbnail?.url ?? null,
        });

      console.log(
        `[News] Sent publish notification for "${newsWithUrls.title}": ${sent} sent, ${failed.length} failed.`,
      );
    } catch (err: any) {
      console.error(
        '[News] Failed to notify subscribers of new news:',
        err.message,
      );
    }
  }

  // ─── NEWS CATEGORIE  ────────────────────────────────────────────────────────────────

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
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');

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

  // ─── NEWS  ────────────────────────────────────────────────────────────────

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

      let uploadedThumbnail: any = null;
      if (createNewsDto.thumbnail) {
        const t = createNewsDto.thumbnail;
        uploadedThumbnail = {
          objectName: t.objectName,
          originalName: t.originalName,
          bucket: t.bucket || 'htcaa',
          mimetype: t.mimeType || t.mimetype,
          size: t.size,
        };
      }

      let uploadedImages: any[] = [];
      if (createNewsDto.images && createNewsDto.images.length > 0) {
        uploadedImages = createNewsDto.images.map((img: any) => ({
          objectName: img.objectName,
          originalName: img.originalName,
          bucket: img.bucket || 'htcaa',
          mimetype: img.mimeType || img.mimetype,
          size: img.size,
        }));
      }

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
        thumbnail: uploadedThumbnail ?? null,
        images: uploadedImages,
      });

      const populatedNews = await this.newsModel
        .findById(news._id)
        .populate(this.getNewsPopulateQuery());

      const newsWithUrls = await this.attachNewsFileUrls(populatedNews);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create news successfully',
        content: {
          news: newsWithUrls,
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
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');

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

      const itemsWithUrls = await this.attachNewsListFileUrls(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get news list successfully',
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
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');

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

      const itemsWithUrls = await this.attachNewsListFileUrls(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get admin news list successfully',
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

      const newsWithUrls = await this.attachNewsFileUrls(news);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get news detail successfully',
        content: {
          news: newsWithUrls,
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
            isFeatured: true,
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

      void this.notifySubscribersOfPublishedNews(news);

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
            isFeatured: false,
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

  async createComment(
    newsId: string,
    userId: string,
    createCommentDto: CreateNewsCommentDto,
  ) {
    try {
      if (!Types.ObjectId.isValid(newsId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid news id',
          content: null,
        };
      }

      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      const news = await this.newsModel.findOne({
        _id: new Types.ObjectId(newsId),
        isActive: true,
        status: NewsStatus.PUBLISHED,
      });

      if (!news) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News not found or not published',
          content: null,
        };
      }

      const user = await this.userModel.findOne({
        _id: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found or inactive',
          content: null,
        };
      }

      const comment = await this.newsCommentModel.create({
        newsId: new Types.ObjectId(newsId),
        userId: new Types.ObjectId(userId),
        content: createCommentDto.content,
        isActive: true,
      });

      const populatedComment = await this.newsCommentModel
        .findById(comment._id)
        .populate({
          path: 'userId',
          select: 'name email role',
        });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create news comment successfully',
        content: {
          comment: populatedComment,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating news comment: ${error.message}`,
        content: null,
      };
    }
  }

  async findCommentsByNewsId(newsId: string, query: QueryNewsCommentDto) {
    try {
      if (!Types.ObjectId.isValid(newsId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid news id',
          content: null,
        };
      }

      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const news = await this.newsModel.findOne({
        _id: new Types.ObjectId(newsId),
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

      const filter = {
        newsId: new Types.ObjectId(newsId),
        isActive: true,
      };

      const [items, total] = await Promise.all([
        this.newsCommentModel
          .find(filter)
          .populate({
            path: 'userId',
            select: 'name email role',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.newsCommentModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get news comments successfully',
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
        message: `There is a problem while getting news comments: ${error.message}`,
        content: null,
      };
    }
  }

  async updateComment(
    commentId: string,
    userId: string,
    role: Role,
    updateCommentDto: UpdateNewsCommentDto,
  ) {
    try {
      if (!Types.ObjectId.isValid(commentId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid comment id',
          content: null,
        };
      }

      const comment = await this.newsCommentModel.findOne({
        _id: new Types.ObjectId(commentId),
        isActive: true,
      });

      if (!comment) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Comment not found',
          content: null,
        };
      }

      const isOwner = (comment as any).userId?.toString() === userId;
      const isAdminOrEditor = role === Role.ADMIN || role === Role.EDITOR;

      if (!isOwner && !isAdminOrEditor) {
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to update this comment',
          content: null,
        };
      }

      const updatedComment = await this.newsCommentModel
        .findByIdAndUpdate(
          commentId,
          {
            content: updateCommentDto.content,
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate({
          path: 'userId',
          select: 'name email role',
        });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update news comment successfully',
        content: {
          comment: updatedComment,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating news comment: ${error.message}`,
        content: null,
      };
    }
  }

  async deleteComment(commentId: string, userId: string, role: Role) {
    try {
      if (!Types.ObjectId.isValid(commentId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid comment id',
          content: null,
        };
      }

      const comment = await this.newsCommentModel.findOne({
        _id: new Types.ObjectId(commentId),
        isActive: true,
      });

      if (!comment) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Comment not found',
          content: null,
        };
      }

      const isOwner = (comment as any).userId?.toString() === userId;
      const isAdminOrEditor = role === Role.ADMIN || role === Role.EDITOR;

      if (!isOwner && !isAdminOrEditor) {
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You do not have permission to delete this comment',
          content: null,
        };
      }

      const deletedComment = await this.newsCommentModel
        .findByIdAndUpdate(
          commentId,
          {
            isActive: false,
          },
          {
            returnDocument: 'after',
          },
        )
        .populate({
          path: 'userId',
          select: 'name email role',
        });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete news comment successfully',
        content: {
          comment: deletedComment,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting news comment: ${error.message}`,
        content: null,
      };
    }
  }

  async uploadThumbnail(
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
          message: 'Thumbnail image is required',
          content: null,
        };
      }

      const { error, news } = await this.findActiveNewsForModify(
        id,
        userId,
        role,
      );

      if (error) {
        return error;
      }

      const result = await this.minioService.uploadFile(file, 'news/images');

      if ((news as any).thumbnail?.objectName) {
        await this.minioService.removeFile((news as any).thumbnail.objectName);
      }

      const fileMetadata = {
        objectName: result.objectName,
        originalName: result.originalName,
        bucket: result.bucket || 'htcaa',
        mimetype: result.mimetype,
        size: result.size,
      };

      const updatedNews = await this.newsModel
        .findByIdAndUpdate(
          id,
          {
            thumbnail: fileMetadata,
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate(this.getNewsPopulateQuery());

      const newsWithUrls = await this.attachNewsFileUrls(updatedNews);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Upload news thumbnail successfully',
        content: {
          news: newsWithUrls,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading news thumbnail: ${error.message}`,
        content: null,
      };
    }
  }

  async deleteThumbnail(id: string, userId: string, role: Role) {
    try {
      const { error, news } = await this.findActiveNewsForModify(
        id,
        userId,
        role,
      );

      if (error) {
        return error;
      }

      if ((news as any).thumbnail?.objectName) {
        await this.minioService.removeFile((news as any).thumbnail.objectName);
      }

      const updatedNews = await this.newsModel
        .findByIdAndUpdate(
          id,
          {
            thumbnail: null,
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate(this.getNewsPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete news thumbnail successfully',
        content: {
          news: updatedNews,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting news thumbnail: ${error.message}`,
        content: null,
      };
    }
  }

  async uploadImages(
    id: string,
    userId: string,
    role: Role,
    files?: Express.Multer.File[],
  ) {
    try {
      if (!files || files.length === 0) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'At least one image is required',
          content: null,
        };
      }

      const { error } = await this.findActiveNewsForModify(id, userId, role);

      if (error) {
        return error;
      }

      const fileMetadatas = await Promise.all(
        files.map(async (file) => {
          const result = await this.minioService.uploadFile(
            file,
            'news/images',
          );
          return {
            objectName: result.objectName,
            originalName: result.originalName,
            bucket: result.bucket || 'htcaa',
            mimetype: result.mimetype,
            size: result.size,
          };
        }),
      );

      const updatedNews = await this.newsModel
        .findByIdAndUpdate(
          id,
          {
            $push: {
              images: {
                $each: fileMetadatas,
              },
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate(this.getNewsPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Upload news images successfully',
        content: {
          news: updatedNews,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading news images: ${error.message}`,
        content: null,
      };
    }
  }

  async deleteImage(
    id: string,
    userId: string,
    role: Role,
    objectName: string,
  ) {
    try {
      if (!objectName) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Image objectName is required',
          content: null,
        };
      }

      const { error, news } = await this.findActiveNewsForModify(
        id,
        userId,
        role,
      );

      if (error) {
        return error;
      }

      const image = (news as any).images?.find(
        (item: any) => item.objectName === objectName,
      );

      if (!image) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'News image not found',
          content: null,
        };
      }

      await this.minioService.removeFile(objectName);

      const updatedNews = await this.newsModel
        .findByIdAndUpdate(
          id,
          {
            $pull: {
              images: {
                objectName,
              },
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate(this.getNewsPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete news image successfully',
        content: {
          news: updatedNews,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting news image: ${error.message}`,
        content: null,
      };
    }
  }
}
