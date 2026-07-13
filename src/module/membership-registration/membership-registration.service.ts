import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { MembershipRegistration } from '../../schema/membership-registration.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { escapeRegex } from '../../utils/escape-regex';
import { CreateMembershipRegistrationDto } from './dto/create-membership-registration.req';
import { QueryMembershipRegistrationDto } from './dto/query-membership-registration.req';
import { UpdateMembershipRegistrationDto } from './dto/update-membership-registration.req';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class MembershipRegistrationService {
  constructor(
    @InjectModel(MembershipRegistration.name)
    private readonly membershipRegistrationModel: Model<MembershipRegistration>,
    private readonly minioService: MinioService,
  ) {}

  // ─── HELPERS  ────────────────────────────────────────────────────────────────

  private async attachFileUrls(registration: any) {
    if (!registration) return registration;
    const obj =
      typeof registration.toObject === 'function'
        ? registration.toObject()
        : registration;

    if (obj.avatar?.objectName) {
      try {
        obj.avatar = await this.minioService.attachPresignedUrl(obj.avatar);
      } catch (err: any) {
        console.error(
          `Failed to generate presigned URL for avatar ${obj.avatar?.objectName}:`,
          err.message,
        );
      }
    }

    if (obj.banner?.objectName) {
      try {
        obj.banner = await this.minioService.attachPresignedUrl(obj.banner);
      } catch (err: any) {
        console.error(
          `Failed to generate presigned URL for banner ${obj.banner?.objectName}:`,
          err.message,
        );
      }
    }

    return obj;
  }

  private buildFileMetadata(uploadResult: any) {
    return {
      objectName: uploadResult.objectName,
      originalName: uploadResult.originalName,
      bucket: uploadResult.bucket || 'htcaa',
      mimetype: uploadResult.mimetype,
      size: uploadResult.size,
    };
  }

  private async attachFileUrlsToList(registrations: any[]) {
    return Promise.all(registrations.map((r) => this.attachFileUrls(r)));
  }

  async create(dto: CreateMembershipRegistrationDto) {
    try {
      let avatarFile: any = null;
      if (dto.avatarFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.avatarFile,
          'membership-registrations/avatars',
        );
        avatarFile = this.buildFileMetadata(uploadResult);
      }

      let bannerFile: any = null;
      if (dto.bannerFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.bannerFile,
          'membership-registrations/banners',
        );
        bannerFile = this.buildFileMetadata(uploadResult);
      }

      const registration = await this.membershipRegistrationModel.create({
        name: dto.name,
        memberType: dto.memberType,
        address: dto.address,
        taxCode: dto.taxCode,
        identityCode: dto.identityCode,
        job: dto.job,
        position: dto.position,
        dateOfBirth: new Date(dto.dateOfBirth),
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        status: 'pending',
        joinAt: null,
        avatar: avatarFile,
        isProfessionalCertification: dto.isProfessionalCertification,
        professionalCertificationNumber: dto.professionalCertificationNumber,
        companyName: dto.companyName,
        companyLicense: dto.companyLicense ?? null,
        companyWebsiteUrl: dto.companyWebsiteUrl ?? null,
        companyPhoneNumber: dto.companyPhoneNumber ?? null,
        companyJobType: dto.companyJobType ?? null,
        companySlogan: dto.companySlogan ?? null,
        introduceBy: dto.introduceBy ?? null,
        banner: bannerFile,
        isActive: true,
      });

      const resultWithUrls = await this.attachFileUrls(registration);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Đăng ký hội viên thành công',
        content: { registration: resultWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async findAll(query: QueryMembershipRegistrationDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.memberType) {
        filter.memberType = query.memberType;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');
        filter.$or = [{ name: regex }, { address: regex }];
      }

      const [items, total] = await Promise.all([
        this.membershipRegistrationModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.membershipRegistrationModel.countDocuments(filter),
      ]);

      const itemsWithUrls = await this.attachFileUrlsToList(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get membership registrations successfully',
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
        message: `There is a problem while getting membership registrations: ${error.message}`,
        content: null,
      };
    }
  }

  async delete(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const deleted = await this.membershipRegistrationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), isActive: true },
        { isActive: false },
        { returnDocument: 'after' },
      );

      if (!deleted) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      const deletedWithUrls = await this.attachFileUrls(deleted);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete membership registration successfully',
        content: { registration: deletedWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async approve(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const updated = await this.membershipRegistrationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), isActive: true },
        { status: 'approved', joinAt: new Date() },
        { returnDocument: 'after' },
      );

      if (!updated) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      const updatedWithUrls = await this.attachFileUrls(updated);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Approve membership registration successfully',
        content: { registration: updatedWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while approving membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, dto: UpdateMembershipRegistrationDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const existing = await this.membershipRegistrationModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!existing) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      const updateData: any = {};
      if (dto.starRating !== undefined) updateData.starRating = dto.starRating;
      if (dto.tenure !== undefined) updateData.tenure = dto.tenure;
      if (dto.tag !== undefined) updateData.tag = dto.tag;

      if (dto.avatarFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.avatarFile,
          'membership-registrations/avatars',
        );

        if ((existing as any).avatar?.objectName) {
          try {
            await this.minioService.removeFile(
              (existing as any).avatar.objectName,
            );
          } catch (err: any) {
            console.error(
              `Failed to remove old avatar ${(existing as any).avatar.objectName}:`,
              err.message,
            );
          }
        }

        updateData.avatar = this.buildFileMetadata(uploadResult);
      }

      if (dto.bannerFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.bannerFile,
          'membership-registrations/banners',
        );

        if ((existing as any).banner?.objectName) {
          try {
            await this.minioService.removeFile(
              (existing as any).banner.objectName,
            );
          } catch (err: any) {
            console.error(
              `Failed to remove old banner ${(existing as any).banner.objectName}:`,
              err.message,
            );
          }
        }

        updateData.banner = this.buildFileMetadata(uploadResult);
      }

      const updated = await this.membershipRegistrationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), isActive: true },
        updateData,
        { returnDocument: 'after' },
      );

      if (!updated) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      const updatedWithUrls = await this.attachFileUrls(updated);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update membership registration successfully',
        content: { registration: updatedWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async findHomepage(query: QueryMembershipRegistrationDto) {
    try {
      const registrations = await this.membershipRegistrationModel
        .find({ isActive: true, status: 'approved' })
        .sort({ joinAt: -1 })
        .limit(5);

      const registrationsWithUrls =
        await this.attachFileUrlsToList(registrations);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get homepage membership registrations successfully',
        content: { registrations: registrationsWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting homepage membership registrations: ${error.message}`,
        content: null,
      };
    }
  }
}
