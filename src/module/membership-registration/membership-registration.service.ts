import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { MembershipRegistration } from '../../schema/membership-registration.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { escapeRegex } from '../../utils/escape-regex';

import { CreateMembershipRegistrationDto } from './dto/create-membership-registration.req';
import { QueryMembershipRegistrationDto } from './dto/query-membership-registration.req';

@Injectable()
export class MembershipRegistrationService {
  constructor(
    @InjectModel(MembershipRegistration.name)
    private readonly membershipRegistrationModel: Model<MembershipRegistration>,
  ) {}

  // ─── Public: khách điền form đăng ký hội viên, không cần đăng nhập ────────
  async create(dto: CreateMembershipRegistrationDto) {
    try {
      const registration = await this.membershipRegistrationModel.create({
        memberName: dto.memberName,
        memberType: dto.memberType,
        address: dto.address,
        shortDescription: dto.shortDescription ?? null,
        website: dto.website ?? null,
        hotline: dto.hotline ?? null,
        email: dto.email ?? null,
        isActive: true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Đăng ký hội viên thành công',
        content: { registration },
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
        filter.$or = [{ memberName: regex }, { address: regex }];
      }

      const [items, total] = await Promise.all([
        this.membershipRegistrationModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.membershipRegistrationModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get membership registrations successfully',
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

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete membership registration successfully',
        content: { registration: deleted },
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
}
