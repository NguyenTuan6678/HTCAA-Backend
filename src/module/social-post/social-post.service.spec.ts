import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SocialPostService } from './social-post.service';
import { SocialPost, SocialPlatform } from '../../schema/social-post.schema';
import { MinioService } from '../minio/minio.service';

describe('SocialPostService', () => {
  let service: SocialPostService;
  let modelMock: any;
  let minioServiceMock: any;

  const mockPost = {
    _id: new Types.ObjectId(),
    platform: SocialPlatform.FACEBOOK,
    title: 'Test Title',
    postUrl: 'https://facebook.com/test',
    thumbnailImage: 'some/thumbnail.png',
    publishedDate: new Date(),
    isPinned: false,
    pinnedOrder: null,
    isActive: true,
    save: jest.fn(),
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    modelMock = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      exists: jest.fn(),
    };

    minioServiceMock = {
      uploadFile: jest.fn(),
      getPresignedUrl: jest.fn(),
      removeFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialPostService,
        {
          provide: getModelToken(SocialPost.name),
          useValue: modelMock,
        },
        {
          provide: MinioService,
          useValue: minioServiceMock,
        },
      ],
    }).compile();

    service = module.get<SocialPostService>(SocialPostService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a social post successfully', async () => {
      const dto = {
        platform: SocialPlatform.FACEBOOK,
        title: 'New Post',
        postUrl: 'https://facebook.com/new',
        publishedDate: '2026-07-06T00:00:00.000Z',
      };

      modelMock.create.mockImplementation((arg) => {
        return Promise.resolve({
          ...mockPost,
          ...arg,
          publishedDate: new Date(dto.publishedDate),
        });
      });

      const result = await service.create(dto);
      expect(result.title).toBe(dto.title);
      expect(result.isPinned).toBe(true);
      expect(result.pinnedOrder).toBe(1);
      expect(modelMock.create).toHaveBeenCalled();
    });

    it('should create a social post with default current date if publishedDate is omitted', async () => {
      const dto = {
        platform: SocialPlatform.FACEBOOK,
        title: 'New Post without date',
        postUrl: 'https://facebook.com/new',
      };

      modelMock.create.mockImplementation((arg) => {
        return Promise.resolve({
          ...mockPost,
          ...arg,
        });
      });

      const result = await service.create(dto);
      expect(result.publishedDate).toBeDefined();
      expect(result.publishedDate).toBeInstanceOf(Date);
      expect(modelMock.create).toHaveBeenCalled();
    });

    it('should automatically pin the post and assign next order when less than 3 pinned posts exist', async () => {
      const dto = {
        platform: SocialPlatform.FACEBOOK,
        title: 'Another post',
        postUrl: 'https://facebook.com/another',
        isActive: true,
      };

      modelMock.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { _id: new Types.ObjectId(), platform: SocialPlatform.FACEBOOK, isPinned: true, pinnedOrder: 1 },
        ]),
      });

      modelMock.create.mockImplementation((arg) => {
        return Promise.resolve({
          ...mockPost,
          ...arg,
        });
      });

      const result = await service.create(dto);
      expect(result.isPinned).toBe(true);
      expect(result.pinnedOrder).toBe(2);
      expect(modelMock.create).toHaveBeenCalledWith(expect.objectContaining({
        isPinned: true,
        pinnedOrder: 2,
      }));
    });

    it('should automatically unpin the oldest pinned post and pin the new one when 3 pinned posts already exist', async () => {
      const dto = {
        platform: SocialPlatform.FACEBOOK,
        title: 'Forced pin post',
        postUrl: 'https://facebook.com/forced',
        isActive: true,
      };

      const existingPosts = [
        { _id: new Types.ObjectId(), platform: SocialPlatform.FACEBOOK, isPinned: true, pinnedOrder: 1, save: jest.fn() },
        { _id: new Types.ObjectId(), platform: SocialPlatform.FACEBOOK, isPinned: true, pinnedOrder: 2, save: jest.fn() },
        { _id: new Types.ObjectId(), platform: SocialPlatform.FACEBOOK, isPinned: true, pinnedOrder: 3, save: jest.fn() },
      ];

      modelMock.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(existingPosts),
      });

      modelMock.create.mockImplementation((arg) => {
        return Promise.resolve({
          ...mockPost,
          ...arg,
        });
      });

      const result = await service.create(dto);
      expect(existingPosts[2].isPinned).toBe(false);
      expect(existingPosts[2].pinnedOrder).toBeNull();
      expect(existingPosts[2].save).toHaveBeenCalled();
      expect(result.isPinned).toBe(true);
      expect(result.pinnedOrder).toBe(3);
      expect(modelMock.create).toHaveBeenCalledWith(expect.objectContaining({
        isPinned: true,
        pinnedOrder: 3,
      }));
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if post not found', async () => {
      modelMock.findById.mockResolvedValue(null);
      const id = new Types.ObjectId().toString();

      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    });

    it('should return the post if found', async () => {
      modelMock.findById.mockResolvedValue(mockPost);
      const id = mockPost._id.toString();

      const result = await service.findOne(id);
      expect(result._id).toBe(mockPost._id);
    });
  });

  describe('pin logic', () => {
    it('should successfully pin a post when count is less than 3', async () => {
      const postToPin = {
        ...mockPost,
        isPinned: false,
        pinnedOrder: null,
        platform: SocialPlatform.FACEBOOK,
        save: jest.fn().mockResolvedValue(this),
      };

      modelMock.findById.mockResolvedValue(postToPin);
      modelMock.countDocuments.mockResolvedValue(2); // 2 pinned posts exists
      modelMock.exists.mockResolvedValue(null); // order 1 is not taken

      const result = await service.pin(postToPin._id.toString(), {
        isPinned: true,
        pinnedOrder: 1,
      });

      expect(result.isPinned).toBe(true);
      expect(result.pinnedOrder).toBe(1);
      expect(postToPin.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when pinning and count is already 3', async () => {
      const postToPin = {
        ...mockPost,
        isPinned: false,
        pinnedOrder: null,
        platform: SocialPlatform.FACEBOOK,
      };

      modelMock.findById.mockResolvedValue(postToPin);
      modelMock.countDocuments.mockResolvedValue(3); // already 3 pinned posts

      await expect(
        service.pin(postToPin._id.toString(), { isPinned: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when pinning with a duplicate order', async () => {
      const postToPin = {
        ...mockPost,
        isPinned: false,
        pinnedOrder: null,
        platform: SocialPlatform.FACEBOOK,
      };

      modelMock.findById.mockResolvedValue(postToPin);
      modelMock.countDocuments.mockResolvedValue(1); // 1 pinned post exists
      modelMock.exists.mockResolvedValue(true); // order 2 is already taken

      await expect(
        service.pin(postToPin._id.toString(), {
          isPinned: true,
          pinnedOrder: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully unpin a post and set pinnedOrder to null', async () => {
      const postToUnpin = {
        ...mockPost,
        isPinned: true,
        pinnedOrder: 2,
        save: jest.fn().mockResolvedValue(this),
      };

      modelMock.findById.mockResolvedValue(postToUnpin);

      const result = await service.pin(postToUnpin._id.toString(), {
        isPinned: false,
      });

      expect(result.isPinned).toBe(false);
      expect(result.pinnedOrder).toBeNull();
      expect(postToUnpin.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete by setting isActive to false', async () => {
      modelMock.findByIdAndUpdate.mockResolvedValue(mockPost);
      const id = mockPost._id.toString();

      const result = await service.delete(id);
      expect(result.success).toBe(true);
      expect(modelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { isActive: false },
        { new: true },
      );
    });
  });
});
