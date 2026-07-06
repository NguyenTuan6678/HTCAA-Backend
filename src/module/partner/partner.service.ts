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

  // =========================
  // HELPERS
  // =========================

  private async attachLogoUrl(partner: any) {
    if (!partner) return partner;
    const obj = typeof partner.toObject === 'function' ? partner.toObject() : partner;
    if (obj.logo) {
      if (!obj.logo.startsWith('http://') && !obj.logo.startsWith('https://')) {
        try {
          obj.logo = await this.minioService.getPresignedUrl(obj.logo);
        } catch (err: any) {
          console.error(
            `Failed to generate presigned URL for logo ${obj.logo}:`,
            err.message,
          );
        }
      }
    }
    return obj;
  }

  private async attachLogoUrlToList(partners: any[]) {
    return Promise.all(partners.map((p) => this.attachLogoUrl(p)));
  }

  // =========================
  // CRUD
  // =========================

  async create(dto: CreatePartnerDto) {
    // Automatically assign displayOrder = total count + 1
    const totalCount = await this.partnerModel.countDocuments();
    const displayOrder = totalCount + 1;

    const partner = await this.partnerModel.create({
      name: dto.name,
      logo: dto.logo,
      tagline: dto.tagline,
      description: dto.description,
      displayOrder,
      isActive: dto.isActive ?? true,
    });

    return this.attachLogoUrl(partner);
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

    const itemsWithUrls = await this.attachLogoUrlToList(items);

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

    return this.attachLogoUrl(partner);
  }

  async update(id: string, dto: UpdatePartnerDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đối tác không hợp lệ.');
    }

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.logo !== undefined) updateData.logo = dto.logo;
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

    return this.attachLogoUrl(partner);
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

  // =========================
  // REORDER (DRAG & DROP)
  // =========================

  async reorder(dto: ReorderPartnersDto) {
    // 1. Validate: displayOrder uniqueness in input array
    const orders = dto.items.map((item) => item.displayOrder);
    const hasDuplicates = new Set(orders).size !== orders.length;
    if (hasDuplicates) {
      throw new BadRequestException(
        'Thứ tự hiển thị (displayOrder) trong danh sách không được trùng nhau.',
      );
    }

    // 2. Validate: all IDs must exist in the database
    const ids = dto.items.map((item) => new Types.ObjectId(item.id));
    const existingCount = await this.partnerModel.countDocuments({
      _id: { $in: ids },
    });

    if (existingCount !== ids.length) {
      throw new BadRequestException(
        'Một hoặc nhiều ID đối tác gửi lên không tồn tại trong hệ thống. Thao tác bị hủy bỏ để đảm bảo tính đồng bộ.',
      );
    }

    // 3. Atomically perform bulk updates to reindex displayOrder
    const bulkOps = dto.items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { displayOrder: item.displayOrder },
      },
    }));

    await this.partnerModel.bulkWrite(bulkOps);

    return { success: true };
  }

  // =========================
  // FILE UPLOAD
  // =========================

  async uploadLogo(id: string, file: Express.Multer.File) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đối tác không hợp lệ.');
    }

    const partner = await this.partnerModel.findById(id);
    if (!partner) {
      throw new NotFoundException('Đối tác không tồn tại.');
    }

    // Upload to MinIO bucket
    const result = await this.minioService.uploadFile(file, 'partners/logos');

    // Clean up old logo if it was a MinIO object key
    if (
      partner.logo &&
      !partner.logo.startsWith('http://') &&
      !partner.logo.startsWith('https://')
    ) {
      try {
        await this.minioService.removeFile(partner.logo);
      } catch (err: any) {
        console.error(
          `Failed to remove old logo ${partner.logo}:`,
          err.message,
        );
      }
    }

    partner.logo = result.objectName;
    await partner.save();

    return this.attachLogoUrl(partner);
  }

  // =========================
  // PUBLIC HOMEPAGE
  // =========================

  async findHomepage() {
    const partners = await this.partnerModel
      .find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });

    const partnersWithUrls = await this.attachLogoUrlToList(partners);

    // Map output to only return presentation fields
    return partnersWithUrls.map((p) => ({
      name: p.name,
      logo: p.logo,
      tagline: p.tagline,
      description: p.description,
      displayOrder: p.displayOrder,
    }));
  }
}
