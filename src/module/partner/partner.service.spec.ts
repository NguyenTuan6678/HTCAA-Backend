import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PartnerService } from './partner.service';
import { Partner } from '../../schema/partner.schema';
import { MinioService } from '../minio/minio.service';

describe('PartnerService', () => {
  let service: PartnerService;
  let modelMock: any;
  let minioServiceMock: any;

  const mockPartner = {
    _id: new Types.ObjectId(),
    name: 'M-Invoice',
    logo: 'partners/logos/m-invoice.png',
    tagline: 'Slogan',
    description: 'Description',
    displayOrder: 1,
    isActive: true,
    save: jest.fn(),
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    modelMock = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      bulkWrite: jest.fn(),
    };

    minioServiceMock = {
      uploadFile: jest.fn(),
      getPresignedUrl: jest.fn(),
      removeFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerService,
        {
          provide: getModelToken(Partner.name),
          useValue: modelMock,
        },
        {
          provide: MinioService,
          useValue: minioServiceMock,
        },
      ],
    }).compile();

    service = module.get<PartnerService>(PartnerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a partner and auto-assign displayOrder', async () => {
      const dto = {
        name: 'New Partner',
        logo: 'logo.png',
        tagline: 'Tagline',
        description: 'Desc',
      };

      modelMock.countDocuments.mockResolvedValue(5); // 5 partners exist
      modelMock.create.mockResolvedValue({
        ...mockPartner,
        ...dto,
        displayOrder: 6,
      });

      const result = await service.create(dto);
      expect(result.displayOrder).toBe(6);
      expect(modelMock.countDocuments).toHaveBeenCalled();
      expect(modelMock.create).toHaveBeenCalledWith({
        ...dto,
        displayOrder: 6,
        isActive: true,
      });
    });
  });

  describe('reorder', () => {
    const id1 = new Types.ObjectId().toString();
    const id2 = new Types.ObjectId().toString();

    it('should throw BadRequestException if displayOrders are duplicate', async () => {
      const dto = {
        items: [
          { id: id1, displayOrder: 1 },
          { id: id2, displayOrder: 1 }, // duplicate order
        ],
      };

      await expect(service.reorder(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if any ID is missing from DB', async () => {
      const dto = {
        items: [
          { id: id1, displayOrder: 1 },
          { id: id2, displayOrder: 2 },
        ],
      };

      modelMock.countDocuments.mockResolvedValue(1); // Only 1 exists, 2 was expected

      await expect(service.reorder(dto)).rejects.toThrow(BadRequestException);
      expect(modelMock.bulkWrite).not.toHaveBeenCalled();
    });

    it('should perform bulkWrite when reorder data is valid', async () => {
      const dto = {
        items: [
          { id: id1, displayOrder: 1 },
          { id: id2, displayOrder: 2 },
        ],
      };

      modelMock.countDocuments.mockResolvedValue(2); // both exist
      modelMock.bulkWrite.mockResolvedValue({ ok: 1 });

      const result = await service.reorder(dto);
      expect(result.success).toBe(true);
      expect(modelMock.bulkWrite).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete by setting isActive to false', async () => {
      modelMock.findByIdAndUpdate.mockResolvedValue(mockPartner);
      const id = mockPartner._id.toString();

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
