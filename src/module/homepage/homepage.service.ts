import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { HomepageSetting } from '../../schema/homepage-setting.schema';
import { News } from '../../schema/news.schema';
import { NewsCategory } from '../../schema/news-category.schema';
import { User } from '../../schema/user.schema';
import { Member } from '../../schema/member.schema';

import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { NewsStatus } from '../../utils/new-status.enum';

import { UpdateHomepageSettingDto } from './dto/update-homepage-setting.req';
import { DEFAULT_HOMEPAGE_SETTING } from './data/homepage-default.data';
import { MinioService } from '../minio/minio.service';
import { Course } from '../../schema/course.schema';
import { CourseStatus } from '../../utils/course-status.enum';

@Injectable()
export class HomepageService {
  constructor(
    @InjectModel(HomepageSetting.name)
    private readonly homepageSettingModel: Model<HomepageSetting>,

    @InjectModel(News.name)
    private readonly newsModel: Model<News>,

    @InjectModel(NewsCategory.name)
    private readonly newsCategoryModel: Model<NewsCategory>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,

    @InjectModel(Course.name)
    private readonly courseModel: Model<Course>,

    private readonly minioService: MinioService,
  ) {}

  private getNewsPopulateQuery() {
    return [
      {
        path: 'createdBy',
        model: User.name,
        select: 'name email role',
      },
      {
        path: 'categoryId',
        model: NewsCategory.name,
        select: 'name slug description isActive',
      },
    ];
  }

  private async getOrCreateHomepageSetting() {
    let setting = await this.homepageSettingModel.findOne({
      key: 'homepage',
      isActive: true,
    });

    if (!setting) {
      setting = await this.homepageSettingModel.create(
        DEFAULT_HOMEPAGE_SETTING,
      );
    }

    return setting;
  }

  private async replaceHomepageMedia(
    currentFile: any,
    file: Express.Multer.File,
    folder: string,
  ) {
    if (currentFile?.objectName) {
      await this.minioService.removeFile(currentFile.objectName);
    }

    return this.minioService.uploadFile(file, folder);
  }

  private getNestedValue(object: any, path: string) {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, object);
  }

  private async attachHomepageSettingFileUrls(setting: any) {
    if (!setting) return setting;

    const settingObject =
      typeof setting.toObject === 'function' ? setting.toObject() : setting;

    if (settingObject.hero?.visual?.image?.objectName) {
      settingObject.hero.visual.image =
        await this.minioService.attachPresignedUrl(
          settingObject.hero.visual.image,
        );
    }

    if (settingObject.presidentQuote?.avatar?.objectName) {
      settingObject.presidentQuote.avatar =
        await this.minioService.attachPresignedUrl(
          settingObject.presidentQuote.avatar,
        );
    }

    const channels = settingObject.socialHub?.channels;

    if (Array.isArray(channels)) {
      settingObject.socialHub.channels = await Promise.all(
        channels.map(async (channel: any) => {
          if (channel.qrCode?.objectName) {
            return {
              ...channel,
              qrCode: await this.minioService.attachPresignedUrl(
                channel.qrCode,
              ),
            };
          }

          return channel;
        }),
      );
    }

    return settingObject;
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

  async seedHomepageSetting() {
    try {
      const existed = await this.homepageSettingModel.findOne({
        key: 'homepage',
      });

      if (existed) {
        return {
          code: ERROR_RES.SUCCESS.statusCode,
          info: ERROR_INFO.SUCCESS,
          message: 'Homepage setting already exists',
          content: {
            setting: existed,
          },
        };
      }

      const setting = await this.homepageSettingModel.create(
        DEFAULT_HOMEPAGE_SETTING,
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Seed homepage setting successfully',
        content: {
          setting,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while seeding homepage setting: ${error.message}`,
        content: null,
      };
    }
  }

  async findPublic() {
    try {
      const setting = await this.getOrCreateHomepageSetting();

      const [news, courses, featuredMembers] = await Promise.all([
        this.newsModel
          .find({
            isActive: true,
            status: NewsStatus.PUBLISHED,
          })
          .populate(this.getNewsPopulateQuery())
          .sort({ isFeatured: -1, publishedAt: -1, createdAt: -1 })
          .limit(6),

        this.courseModel
          .find({
            isActive: true,
            status: CourseStatus.OPEN,
            date: {
              $gte: new Date(),
            },
          })
          .populate({
            path: 'createdBy',
            model: User.name,
            select: 'name email role',
          })
          .sort({ date: 1, createdAt: -1 })
          .limit(4),

        this.memberModel
          .find({
            isActive: true,
            isFeatured: true,
          })
          .populate({
            path: 'userId',
            select: 'name email role',
          })
          .sort({ featuredOrder: 1, createdAt: -1 })
          .limit(4),
      ]);

      const settingWithUrls = await this.attachHomepageSettingFileUrls(setting);

      const newsWithUrls = await Promise.all(
        news.map((item) => this.attachNewsFileUrls(item)),
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get homepage successfully',
        content: {
          settings: settingWithUrls,
          news: newsWithUrls,
          courses,
          featuredMembers,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting homepage: ${error.message}`,
        content: null,
      };
    }
  }

  async findAdmin() {
    try {
      const setting = await this.getOrCreateHomepageSetting();
      const settingWithUrls = await this.attachHomepageSettingFileUrls(setting);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get homepage setting successfully',
        content: {
          setting: settingWithUrls,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting homepage setting: ${error.message}`,
        content: null,
      };
    }
  }

  async update(updateHomepageSettingDto: UpdateHomepageSettingDto) {
    try {
      const updateData: any = {};

      if (updateHomepageSettingDto.seo !== undefined) {
        updateData.seo = updateHomepageSettingDto.seo;
      }

      if (updateHomepageSettingDto.topbar !== undefined) {
        updateData.topbar = updateHomepageSettingDto.topbar;
      }

      if (updateHomepageSettingDto.header !== undefined) {
        updateData.header = updateHomepageSettingDto.header;
      }

      if (updateHomepageSettingDto.hero !== undefined) {
        updateData.hero = updateHomepageSettingDto.hero;
      }

      if (updateHomepageSettingDto.heroStats !== undefined) {
        updateData.heroStats = updateHomepageSettingDto.heroStats;
      }

      if (updateHomepageSettingDto.ctaCards !== undefined) {
        updateData.ctaCards = updateHomepageSettingDto.ctaCards;
      }

      if (updateHomepageSettingDto.trustStrip !== undefined) {
        updateData.trustStrip = updateHomepageSettingDto.trustStrip;
      }

      if (updateHomepageSettingDto.quickServices !== undefined) {
        updateData.quickServices = updateHomepageSettingDto.quickServices;
      }

      if (updateHomepageSettingDto.presidentQuote !== undefined) {
        updateData.presidentQuote = updateHomepageSettingDto.presidentQuote;
      }

      if (updateHomepageSettingDto.socialHub !== undefined) {
        updateData.socialHub = updateHomepageSettingDto.socialHub;
      }

      if (updateHomepageSettingDto.finalCta !== undefined) {
        updateData.finalCta = updateHomepageSettingDto.finalCta;
      }

      if (updateHomepageSettingDto.footer !== undefined) {
        updateData.footer = updateHomepageSettingDto.footer;
      }

      if (updateHomepageSettingDto.isActive !== undefined) {
        updateData.isActive = updateHomepageSettingDto.isActive;
      }

      const setting = await this.homepageSettingModel.findOneAndUpdate(
        {
          key: 'homepage',
        },
        {
          $set: {
            key: 'homepage',
            ...updateData,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
        },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update homepage setting successfully',
        content: {
          setting,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating homepage setting: ${error.message}`,
        content: null,
      };
    }
  }

  async resetToDefault() {
    try {
      const setting = await this.homepageSettingModel.findOneAndUpdate(
        {
          key: 'homepage',
        },
        {
          $set: DEFAULT_HOMEPAGE_SETTING,
        },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
        },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Reset homepage setting successfully',
        content: {
          setting,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while resetting homepage setting: ${error.message}`,
        content: null,
      };
    }
  }

  async updateSection(section: string, data: Record<string, any>) {
    try {
      const allowedSections = [
        'seo',
        'topbar',
        'header',
        'hero',
        'heroStats',
        'ctaCards',
        'trustStrip',
        'quickServices',
        'presidentQuote',
        'socialHub',
        'finalCta',
        'footer',
      ];

      if (!allowedSections.includes(section)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid homepage section',
          content: null,
        };
      }

      const setting = await this.homepageSettingModel.findOneAndUpdate(
        {
          key: 'homepage',
        },
        {
          $set: {
            key: 'homepage',
            [section]: data,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
        },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update homepage section successfully',
        content: {
          setting,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating homepage section: ${error.message}`,
        content: null,
      };
    }
  }

  async uploadHeroImage(file?: Express.Multer.File) {
    try {
      if (!file) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Hero image is required',
          content: null,
        };
      }

      const setting = await this.getOrCreateHomepageSetting();
      const currentImage = this.getNestedValue(setting, 'hero.visual.image');

      // Upload new file directly to MinIO
      const result = await this.minioService.uploadFile(file, 'about-us/images');

      if (currentImage?.objectName) {
        await this.minioService.removeFile(currentImage.objectName);
      }

      const fileMetadata = {
        objectName: result.objectName,
        originalName: result.originalName || '',
        mimeType: result.mimetype || '',
        size: result.size || 0,
      };

      const updatedSetting = await this.homepageSettingModel.findOneAndUpdate(
        {
          key: 'homepage',
        },
        {
          $set: {
            'hero.visual.image': fileMetadata,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      );

      const settingWithUrls =
        await this.attachHomepageSettingFileUrls(updatedSetting);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Upload homepage hero image successfully',
        content: {
          setting: settingWithUrls,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading homepage hero image: ${error.message}`,
        content: null,
      };
    }
  }

  async uploadPresidentAvatar(file?: Express.Multer.File) {
    try {
      if (!file) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'President avatar is required',
          content: null,
        };
      }

      const setting = await this.getOrCreateHomepageSetting();
      const currentAvatar = this.getNestedValue(
        setting,
        'presidentQuote.avatar',
      );

      // Upload new file directly to MinIO
      const result = await this.minioService.uploadFile(file, 'about-us/images');

      if (currentAvatar?.objectName) {
        await this.minioService.removeFile(currentAvatar.objectName);
      }

      const fileMetadata = {
        objectName: result.objectName,
        originalName: result.originalName || '',
        mimeType: result.mimetype || '',
        size: result.size || 0,
      };

      const updatedSetting = await this.homepageSettingModel.findOneAndUpdate(
        {
          key: 'homepage',
        },
        {
          $set: {
            'presidentQuote.avatar': fileMetadata,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Upload president avatar successfully',
        content: {
          setting: updatedSetting,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading president avatar: ${error.message}`,
        content: null,
      };
    }
  }

  async uploadZaloQr(file?: Express.Multer.File) {
    try {
      if (!file) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Zalo QR image is required',
          content: null,
        };
      }

      const setting = await this.getOrCreateHomepageSetting();

      const socialHub: any = setting.socialHub || {};
      const channels = socialHub.channels || [];

      const zaloIndex = channels.findIndex((item: any) => item.key === 'zalo');

      if (zaloIndex === -1) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Zalo channel not found',
          content: null,
        };
      }

      const currentQrCode = channels[zaloIndex]?.qrCode;

      // Upload new file directly to MinIO
      const result = await this.minioService.uploadFile(file, 'about-us/images');

      if (currentQrCode?.objectName) {
        await this.minioService.removeFile(currentQrCode.objectName);
      }

      const fileMetadata = {
        objectName: result.objectName,
        originalName: result.originalName || '',
        mimeType: result.mimetype || '',
        size: result.size || 0,
      };

      channels[zaloIndex].qrCode = fileMetadata;

      const updatedSetting = await this.homepageSettingModel.findOneAndUpdate(
        {
          key: 'homepage',
        },
        {
          $set: {
            socialHub: {
              ...socialHub,
              channels,
            },
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Upload Zalo QR successfully',
        content: {
          setting: updatedSetting,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading Zalo QR: ${error.message}`,
        content: null,
      };
    }
  }
}
