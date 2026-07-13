import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Partner, PartnerDocument } from '../../schema/partner.schema';
import { CreatePartnerDto } from './dto/create-partner.req';
import { UpdatePartnerDto } from './dto/update-partner.req';
import { ReorderPartnersDto } from './dto/reorder-partners.req';
import { QueryPartnerDto } from './dto/query-partner.req';
import { MinioService } from '../minio/minio.service';
import { escapeRegex } from '../../utils/escape-regex';

@Injectable()
export class PartnerService {
  constructor(
    @InjectModel(Partner.name)
    private readonly partnerModel: Model<PartnerDocument>,
    private readonly minioService: MinioService,
  ) {}

  // ─── HELPER METHODS  ────────────────────────────────────────────────────────────────

  private async attachMediaUrls(partner: any) {
    if (!partner) return partner;
    const obj =
      typeof partner.toObject === 'function' ? partner.toObject() : partner;

    for (const field of ['logo', 'banner']) {
      if (obj[field]?.objectName) {
        try {
          obj[field] = await this.minioService.attachPresignedUrl(obj[field]);
        } catch (err: any) {
          console.error(
            `Failed to generate presigned URL for ${field} ${obj[field]?.objectName}:`,
            err.message,
          );
        }
      }
    }

    return obj;
  }

  private buildFileMetadata(uploadResult: any) {
    return {
      objectName: uploadResult.objectName,
      originalName: uploadResult.originalName,
      bucket: uploadResult.bucket || 'htcaa',
      mimetype: uploadResult.mimetype || uploadResult.mimeType,
      size: uploadResult.size,
    };
  }

  private async attachMediaUrlsToList(partners: any[]) {
    return Promise.all(partners.map((p) => this.attachMediaUrls(p)));
  }

  // ─── CRUD  ────────────────────────────────────────────────────────────────

  async create(dto: CreatePartnerDto) {
    const totalCount = await this.partnerModel.countDocuments();
    const displayOrder = totalCount + 1;

    const partner = await this.partnerModel.create({
      name: dto.name,
      logo: dto.logo ? this.buildFileMetadata(dto.logo) : null,
      banner: dto.banner ? this.buildFileMetadata(dto.banner) : null,
      tagline: dto.tagline,
      description: dto.description,
      displayOrder,
      isActive: dto.isActive ?? true,
    });

    return this.attachMediaUrls(partner);
  }

  async findAll(query: QueryPartnerDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.q) {
      const escaped = escapeRegex(query.q);
      filter.name = new RegExp(escaped, 'i');
    }

    const [items, total] = await Promise.all([
      this.partnerModel
        .find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.partnerModel.countDocuments(filter),
    ]);

    const itemsWithUrls = await this.attachMediaUrlsToList(items);

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
      throw new BadRequestException('ID đối tác không hợp lệ.');
    }

    const partner = await this.partnerModel.findById(id);
    if (!partner) {
      throw new NotFoundException('Đối tác không tồn tại.');
    }

    return this.attachMediaUrls(partner);
  }

  async update(id: string, dto: UpdatePartnerDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đối tác không hợp lệ.');
    }

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.logo !== undefined) {
      updateData.logo = dto.logo ? this.buildFileMetadata(dto.logo) : null;
    }
    if (dto.banner !== undefined) {
      updateData.banner = dto.banner
        ? this.buildFileMetadata(dto.banner)
        : null;
    }
    if (dto.tagline !== undefined) updateData.tagline = dto.tagline;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const partner = await this.partnerModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!partner) {
      throw new NotFoundException('Đối tác không tồn tại.');
    }

    return this.attachMediaUrls(partner);
  }

  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đối tác không hợp lệ.');
    }

    const partner = await this.partnerModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!partner) {
      throw new NotFoundException('Đối tác không tồn tại.');
    }

    return { success: true };
  }

  // ─── REORDER (DRAG & DROP) ────────────────────────────────────────────────────────────────

  async reorder(dto: ReorderPartnersDto) {
    const orders = dto.items.map((item) => item.displayOrder);
    const hasDuplicates = new Set(orders).size !== orders.length;
    if (hasDuplicates) {
      throw new BadRequestException(
        'Thứ tự hiển thị (displayOrder) trong danh sách không được trùng nhau.',
      );
    }

    const ids = dto.items.map((item) => new Types.ObjectId(item.id));
    const existingCount = await this.partnerModel.countDocuments({
      _id: { $in: ids },
    });

    if (existingCount !== ids.length) {
      throw new BadRequestException(
        'Một hoặc nhiều ID đối tác gửi lên không tồn tại trong hệ thống. Thao tác bị hủy bỏ để đảm bảo tính đồng bộ.',
      );
    }

    const bulkOps = dto.items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { displayOrder: item.displayOrder },
      },
    }));

    await this.partnerModel.bulkWrite(bulkOps);

    return { success: true };
  }

  // ─── FILE UPLOAD  ────────────────────────────────────────────────────────────────

  async uploadLogo(id: string, file: Express.Multer.File) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đối tác không hợp lệ.');
    }

    const partner = await this.partnerModel.findById(id);
    if (!partner) {
      throw new NotFoundException('Đối tác không tồn tại.');
    }

    const result = await this.minioService.uploadFile(file, 'partners/logos');

    if (partner.logo?.objectName) {
      try {
        await this.minioService.removeFile(partner.logo.objectName);
      } catch (err: any) {
        console.error(
          `Failed to remove old logo ${partner.logo.objectName}:`,
          err.message,
        );
      }
    }

    partner.logo = this.buildFileMetadata(result);
    await partner.save();

    return this.attachMediaUrls(partner);
  }

  async uploadBanner(id: string, file: Express.Multer.File) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đối tác không hợp lệ.');
    }

    const partner = await this.partnerModel.findById(id);
    if (!partner) {
      throw new NotFoundException('Đối tác không tồn tại.');
    }

    const result = await this.minioService.uploadFile(file, 'partners/banners');

    if (partner.banner?.objectName) {
      try {
        await this.minioService.removeFile(partner.banner.objectName);
      } catch (err: any) {
        console.error(
          `Failed to remove old banner ${partner.banner.objectName}:`,
          err.message,
        );
      }
    }

    partner.banner = this.buildFileMetadata(result);
    await partner.save();

    return this.attachMediaUrls(partner);
  }

  // ─── PUBLIC HOMEPAGE  ────────────────────────────────────────────────────────────────

  async findHomepage() {
    const partners = await this.partnerModel
      .find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });

    const partnersWithUrls = await this.attachMediaUrlsToList(partners);

    return partnersWithUrls.map((p: any) => ({
      name: p.name,
      logo: p.logo,
      banner: p.banner,
      tagline: p.tagline,
      description: p.description,
      displayOrder: p.displayOrder,
    }));
  }
}
