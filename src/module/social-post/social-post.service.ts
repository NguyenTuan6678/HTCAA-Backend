import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SocialPost,
  SocialPostDocument,
  SocialPlatform,
} from '../../schema/social-post.schema';
import { CreateSocialPostDto } from './dto/create-social-post.req';
import { UpdateSocialPostDto } from './dto/update-social-post.req';
import { PinSocialPostDto } from './dto/pin-social-post.req';
import { QuerySocialPostDto } from './dto/query-social-post.req';
import { MinioService } from '../minio/minio.service';
import { escapeRegex } from '../../utils/escape-regex';

@Injectable()
export class SocialPostService {
  constructor(
    @InjectModel(SocialPost.name)
    private readonly socialPostModel: Model<SocialPostDocument>,
    private readonly minioService: MinioService,
  ) { }

  // =========================
  // HELPERS
  // =========================

  private async attachThumbnailUrl(post: any) {
    if (!post) return post;
    const obj = typeof post.toObject === 'function' ? post.toObject() : post;
    if (obj.thumbnailImage) {
      if (
        !obj.thumbnailImage.startsWith('http://') &&
        !obj.thumbnailImage.startsWith('https://')
      ) {
        try {
          obj.thumbnailImage = await this.minioService.getPresignedUrl(
            obj.thumbnailImage,
          );
        } catch (err: any) {
          // If MinIO link generation fails, log and fallback to stored path
          console.error(
            `Failed to generate presigned URL for ${obj.thumbnailImage}:`,
            err.message,
          );
        }
      }
    }
    return obj;
  }

  private async attachThumbnailUrlToList(posts: any[]) {
    return Promise.all(posts.map((p) => this.attachThumbnailUrl(p)));
  }

  // =========================
  // CRUD
  // =========================

  async create(dto: CreateSocialPostDto) {
    const post = await this.socialPostModel.create({
      platform: dto.platform,
      title: dto.title,
      postUrl: dto.postUrl,
      thumbnailImage: dto.thumbnailImage ?? null,
      publishedDate: dto.publishedDate ? new Date(dto.publishedDate) : new Date(),
      isPinned: false,
      pinnedOrder: null,
      isActive: dto.isActive ?? true,
    });

    return this.attachThumbnailUrl(post);
  }

  async findAll(query: QuerySocialPostDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.platform !== undefined) {
      filter.platform = query.platform;
    }

    if (query.isPinned !== undefined) {
      filter.isPinned = query.isPinned;
    }

    if (query.q) {
      const escaped = escapeRegex(query.q);
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ title: regex }, { postUrl: regex }];
    }

    const [items, total] = await Promise.all([
      this.socialPostModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.socialPostModel.countDocuments(filter),
    ]);

    const itemsWithUrls = await this.attachThumbnailUrlToList(items);

    return {
      items: itemsWithUrls,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài viết không hợp lệ.');
    }

    const post = await this.socialPostModel.findById(id);
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }

    return this.attachThumbnailUrl(post);
  }

  async update(id: string, dto: UpdateSocialPostDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài viết không hợp lệ.');
    }

    const updateData: any = {};

    if (dto.platform !== undefined) updateData.platform = dto.platform;
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.postUrl !== undefined) updateData.postUrl = dto.postUrl;
    if (dto.thumbnailImage !== undefined)
      updateData.thumbnailImage = dto.thumbnailImage ?? null;
    if (dto.publishedDate !== undefined)
      updateData.publishedDate = new Date(dto.publishedDate);
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const post = await this.socialPostModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }

    return this.attachThumbnailUrl(post);
  }

  async pin(id: string, dto: PinSocialPostDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài viết không hợp lệ.');
    }

    const post = await this.socialPostModel.findById(id);
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }

    if (dto.isPinned) {
      // 1. Check limit of 3 pinned posts on this platform
      const pinnedCount = await this.socialPostModel.countDocuments({
        platform: post.platform,
        isPinned: true,
        isActive: true,
        _id: { $ne: post._id },
      });

      if (pinnedCount >= 3) {
        throw new BadRequestException(
          `Mạng xã hội ${post.platform} đã ghim đủ tối đa 3 bài viết. Vui lòng gỡ ghim bài viết khác trước khi ghim bài mới.`,
        );
      }

      // 2. Validate/assign pinnedOrder
      let pinnedOrder = dto.pinnedOrder;
      if (pinnedOrder != null) {
        const orderExists = await this.socialPostModel.exists({
          platform: post.platform,
          isPinned: true,
          pinnedOrder,
          isActive: true,
          _id: { $ne: post._id },
        });
        if (orderExists) {
          throw new BadRequestException(
            `Thứ tự ghim ${pinnedOrder} đã tồn tại cho mạng xã hội ${post.platform}. Vui lòng chọn thứ tự hiển thị khác.`,
          );
        }
      } else {
        // Auto-assign first positive integer order that is not already taken
        const activePinned = await this.socialPostModel.find({
          platform: post.platform,
          isPinned: true,
          isActive: true,
          _id: { $ne: post._id },
        });
        const taken = activePinned
          .map((p) => p.pinnedOrder)
          .filter((o) => o != null) as number[];
        let nextOrder = 1;
        while (taken.includes(nextOrder)) {
          nextOrder++;
        }
        pinnedOrder = nextOrder;
      }

      post.isPinned = true;
      post.pinnedOrder = pinnedOrder;
    } else {
      post.isPinned = false;
      post.pinnedOrder = null;
    }

    await post.save();
    return this.attachThumbnailUrl(post);
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài viết không hợp lệ.');
    }

    const post = await this.socialPostModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }

    return { success: true };
  }

  async uploadThumbnail(id: string, file: Express.Multer.File) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài viết không hợp lệ.');
    }

    const post = await this.socialPostModel.findById(id);
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại.');
    }

    // Upload new image to MinIO under social-posts folder
    const result = await this.minioService.uploadFile(file, 'social-posts');

    // Clean up old thumbnail if it was a MinIO object key
    if (
      post.thumbnailImage &&
      !post.thumbnailImage.startsWith('http://') &&
      !post.thumbnailImage.startsWith('https://')
    ) {
      try {
        await this.minioService.removeFile(post.thumbnailImage);
      } catch (err: any) {
        console.error(
          `Failed to remove old thumbnail ${post.thumbnailImage}:`,
          err.message,
        );
      }
    }

    post.thumbnailImage = result.objectName;
    await post.save();

    return this.attachThumbnailUrl(post);
  }

  async findHomepage() {
    const [facebookPosts, youtubePosts] = await Promise.all([
      this.socialPostModel
        .find({
          platform: SocialPlatform.FACEBOOK,
          isPinned: true,
          isActive: true,
        })
        .sort({ pinnedOrder: 1, createdAt: -1 })
        .limit(3),
      this.socialPostModel
        .find({
          platform: SocialPlatform.YOUTUBE,
          isPinned: true,
          isActive: true,
        })
        .sort({ pinnedOrder: 1, createdAt: -1 })
        .limit(3),
    ]);

    const fbWithUrls = await this.attachThumbnailUrlToList(facebookPosts);
    const ytWithUrls = await this.attachThumbnailUrlToList(youtubePosts);

    // Map output to return only needed fields for Frontend presentation
    const mapFields = (p: any) => ({
      title: p.title,
      postUrl: p.postUrl,
      thumbnailImage: p.thumbnailImage,
      publishedDate: p.publishedDate,
      platform: p.platform,
    });

    return {
      facebook: fbWithUrls.map(mapFields),
      youtube: ytWithUrls.map(mapFields),
    };
  }
}
