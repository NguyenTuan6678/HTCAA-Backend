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

  // =========================
  // HELPERS
  // =========================

  private async attachFileUrls(registration: any) {
    if (!registration) return registration;
    const obj =
      typeof registration.toObject === 'function'
        ? registration.toObject()
        : registration;

    if (
      obj.avatar &&
      !obj.avatar.startsWith('http://') &&
      !obj.avatar.startsWith('https://')
    ) {
      try {
        obj.avatar = await this.minioService.getPresignedUrl(obj.avatar);
      } catch (err: any) {
        console.error(
          `Failed to generate presigned URL for avatar ${obj.avatar}:`,
          err.message,
        );
      }
    }

    if (
      obj.logo &&
      !obj.logo.startsWith('http://') &&
      !obj.logo.startsWith('https://')
    ) {
      try {
        obj.logo = await this.minioService.getPresignedUrl(obj.logo);
      } catch (err: any) {
        console.error(
          `Failed to generate presigned URL for logo ${obj.logo}:`,
          err.message,
        );
      }
    }

    return obj;
  }

  private async attachFileUrlsToList(registrations: any[]) {
    return Promise.all(registrations.map((r) => this.attachFileUrls(r)));
  }

  // ─── Public: khách điền form đăng ký hội viên, không cần đăng nhập ────────
  async create(dto: CreateMembershipRegistrationDto) {
    try {
      let avatarUrl = '';
      if (dto.avatarFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.avatarFile,
          'membership-registrations/avatars',
        );
        avatarUrl = uploadResult.objectName;
      }

      let logoUrl = null;
      if (dto.logoFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.logoFile,
          'membership-registrations/logos',
        );
        logoUrl = uploadResult.objectName;
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
        avatar: avatarUrl,
        isProfessionalCertification: dto.isProfessionalCertification,
        professionalCertificationNumber: dto.professionalCertificationNumber,
        companyName: dto.companyName,
        companyLicense: dto.companyLicense ?? null,
        companyWebsiteUrl: dto.companyWebsiteUrl ?? null,
        companyPhoneNumber: dto.companyPhoneNumber ?? null,
        companyJobType: dto.companyJobType ?? null,
        companySlogan: dto.companySlogan ?? null,
        introduceBy: dto.introduceBy ?? null,
        logo: logoUrl,
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

  // ─── Admin: xem danh sách các đơn đăng ký hội viên ────────────────────────
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

  // ─── Admin: xóa mềm 1 đơn đăng ký hội viên ────────────────────────────────
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

  // ─── Admin: phê duyệt 1 đơn đăng ký hội viên ──────────────────────────────
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

  // ─── Admin: cập nhật đơn đăng ký hội viên ────────────────────────────
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

      const updateData: any = {};
      if (dto.starRating !== undefined) updateData.starRating = dto.starRating;
      if (dto.tenure !== undefined) updateData.tenure = dto.tenure;
      if (dto.tag !== undefined) updateData.tag = dto.tag;

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
