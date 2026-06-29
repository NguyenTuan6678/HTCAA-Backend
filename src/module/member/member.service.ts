import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Member } from '../../schema/member.schema';
import { User } from '../../schema/user.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { RegisterMemberDto } from './dto/register-member.req';
import { UpdateMemberDto } from './dto/update-member.req';
import { QueryMemberDirectoryDto } from './dto/query-member-directory.req';
import { RejectMemberDto } from './dto/reject-member.req';
import { MemberStatus } from '../../utils/member-status.enum';
import { MemberType } from '../../utils/member-type.enum';
import { Counter } from '../../schema/counter.schema';
import { QueryAdminMemberDto } from './dto/query-admin-member.req';
import { escapeRegex } from '../../utils/escape-regex';

@Injectable()
export class MemberService {
  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
  ) {}

  private toPublicFile(file?: any) {
    if (!file) {
      return null;
    }

    return {
      originalName: file.originalName,
      filename: file.objectName || file.filename,
      path: file.url || file.path,
      mimetype: file.mimeType || file.mimetype,
      size: file.size,
    };
  }

  async register(
    userId: string,
    registerDto: RegisterMemberDto,
  ) {
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

      const existingMember = await this.memberModel.findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      });

      if (existingMember) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile already exists for this user',
          content: null,
        };
      }

      const organization =
        registerDto.memberType === MemberType.ORGANIZATION
          ? {
              name: registerDto.organizationName,
              taxCode: registerDto.organizationTaxCode,
              employeeScale: registerDto.organizationEmployeeScale ?? null,
            }
          : null;

      const memberCode = await this.generateMemberCode();

      const member = await this.memberModel.create({
        userId: new Types.ObjectId(userId),
        memberCode,
        name: registerDto.name,
        dateOfBirth: new Date(registerDto.dateOfBirth),
        email: registerDto.email,
        phone: registerDto.phone,
        certificateNumber: registerDto.certificateNumber,
        workplace: registerDto.workplace ?? null,
        district: registerDto.district ?? null,
        memberType: registerDto.memberType,
        organization,
        paymentMethod: registerDto.paymentMethod,
        profileFile: this.toPublicFile(registerDto.profileFile),
        status: MemberStatus.PENDING,
        isActive: true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Register member successfully',
        content: {
          memberId: member._id.toString(),
          memberCode: member.memberCode,
          status: member.status,
        },
      };
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile already exists for this user',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while registering member: ${error.message}`,
        content: null,
      };
    }
  }

  async me(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      const member = await this.memberModel
        .findOne({
          userId: new Types.ObjectId(userId),
          isActive: true,
        })
        .populate({
          path: 'userId',
          select: 'name email role memberType isActive',
        });

      if (!member) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get member profile successfully',
        content: {
          member,
          membership: {
            status: member.status,
            memberType: member.memberType,
          },
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting member profile: ${error.message}`,
        content: null,
      };
    }
  }

  async updateMe(userId: string, updateMemberDto: UpdateMemberDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      const updateData: any = {};

      if (updateMemberDto.name !== undefined) {
        updateData.name = updateMemberDto.name;
      }

      if (updateMemberDto.dateOfBirth !== undefined) {
        updateData.dateOfBirth = new Date(updateMemberDto.dateOfBirth);
      }

      if (updateMemberDto.email !== undefined) {
        updateData.email = updateMemberDto.email;
      }

      if (updateMemberDto.phone !== undefined) {
        updateData.phone = updateMemberDto.phone;
      }

      if (updateMemberDto.certificateNumber !== undefined) {
        updateData.certificateNumber = updateMemberDto.certificateNumber;
      }

      if (updateMemberDto.workplace !== undefined) {
        updateData.workplace = updateMemberDto.workplace;
      }

      if (updateMemberDto.district !== undefined) {
        updateData.district = updateMemberDto.district;
      }

      const member = await this.memberModel
        .findOneAndUpdate(
          {
            userId: new Types.ObjectId(userId),
            isActive: true,
          },
          updateData,
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate({
          path: 'userId',
          select: 'name email role memberType isActive',
        });

      if (!member) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update member profile successfully',
        content: {
          member,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating member profile: ${error.message}`,
        content: null,
      };
    }
  }

  async directory(query: QueryMemberDirectoryDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = {
        isActive: true,
      };

      if (query.district) {
        filter.district = query.district;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');

        filter.$or = [
          { name: regex },
          { email: regex },
          { phone: regex },
          { certificateNumber: regex },
          { workplace: regex },
          { district: regex },
          { 'organization.name': regex },
          { 'organization.taxCode': regex },
        ];
      }

      const [items, total] = await Promise.all([
        this.memberModel
          .find(filter)
          .populate({
            path: 'userId',
            select: 'name email role memberType isActive',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.memberModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get member directory successfully',
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
        message: `There is a problem while getting member directory: ${error.message}`,
        content: null,
      };
    }
  }

  async approve(id: string, adminId: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid member id',
          content: null,
        };
      }

      if (!Types.ObjectId.isValid(adminId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid admin id',
          content: null,
        };
      }

      const member = await this.memberModel
        .findByIdAndUpdate(
          id,
          {
            status: MemberStatus.ACTIVE,
            approvedBy: new Types.ObjectId(adminId),
            approvedAt: new Date(),
            rejectedBy: null,
            rejectedAt: null,
            rejectReason: null,
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate({
          path: 'userId',
          select: 'name email role memberType isActive',
        })
        .populate({
          path: 'approvedBy',
          select: 'name email role',
        });

      if (!member) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Approve member successfully',
        content: {
          member,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while approving member: ${error.message}`,
        content: null,
      };
    }
  }

  async reject(id: string, adminId: string, rejectMemberDto: RejectMemberDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid member id',
          content: null,
        };
      }

      if (!Types.ObjectId.isValid(adminId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid admin id',
          content: null,
        };
      }

      const member = await this.memberModel
        .findByIdAndUpdate(
          id,
          {
            status: MemberStatus.REJECTED,
            rejectedBy: new Types.ObjectId(adminId),
            rejectedAt: new Date(),
            rejectReason: rejectMemberDto.reason,
            approvedBy: null,
            approvedAt: new Date(),
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate({
          path: 'userId',
          select: 'name email role memberType isActive',
        })
        .populate({
          path: 'rejectedBy',
          select: 'name email role',
        });

      if (!member) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Reject member successfully',
        content: {
          member,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while rejecting member: ${error.message}`,
        content: null,
      };
    }
  }

  async expire(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid member id',
          content: null,
        };
      }

      const member = await this.memberModel
        .findByIdAndUpdate(
          id,
          {
            status: MemberStatus.EXPIRED,
            expiredAt: new Date(),
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
        .populate({
          path: 'userId',
          select: 'name email role memberType isActive',
        });

      if (!member) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Expire member successfully',
        content: {
          member,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while expiring member: ${error.message}`,
        content: null,
      };
    }
  }

  async adminFindAll(query: QueryAdminMemberDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = {
        isActive: true,
      };

      if (query.status) {
        filter.status = query.status;
      }

      if (query.district) {
        filter.district = query.district;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');

        filter.$or = [
          { memberCode: regex },
          { name: regex },
          { email: regex },
          { phone: regex },
          { certificateNumber: regex },
          { workplace: regex },
          { district: regex },
          { 'organization.name': regex },
          { 'organization.taxCode': regex },
        ];
      }

      const [items, total] = await Promise.all([
        this.memberModel
          .find(filter)
          .populate({
            path: 'userId',
            select: 'name email role memberType isActive',
          })
          .populate({
            path: 'approvedBy',
            select: 'name email role',
          })
          .populate({
            path: 'rejectedBy',
            select: 'name email role',
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.memberModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get admin member list successfully',
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
        message: `There is a problem while getting admin member list: ${error.message}`,
        content: null,
      };
    }
  }

  private async generateMemberCode(): Promise<string> {
    const year = new Date().getFullYear();
    const key = `MB${year}`;

    const counter = await this.counterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const seq = String(counter.seq).padStart(6, '0');

    return `HTCAA-${year}-${seq}`;
  }
}
