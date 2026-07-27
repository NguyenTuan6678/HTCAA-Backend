import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Member } from '../../schema/member.schema';
import { User } from '../../schema/user.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { RegisterMemberDto } from './dto/register-member.req';
import { UpdateMemberDto } from './dto/update-member.req';
import { QueryMemberDirectoryDto } from './dto/query-member-directory.req';
import { MemberStatus } from '../../utils/member-status.enum';
import { MemberType } from '../../utils/member-type.enum';
import { Counter } from '../../schema/counter.schema';
import { QueryAdminMemberDto } from './dto/query-admin-member.req';
import { QueryMemberHomepageDto } from './dto/query-member-homepage.req';
import { escapeRegex } from '../../utils/escape-regex';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class MemberService {
  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    private readonly minioService: MinioService,
  ) { }

  private toPublicFile(file?: any) {
    if (!file) {
      return null;
    }

    const filename = file.objectName || file.filename;

    return {
      originalName: file.originalName || file.originalname,
      filename,
      path:
        file.url ||
        (file.objectName
          ? `/uploads/members/${file.objectName}`
          : file.filename
            ? `/uploads/members/${file.filename}`
            : file.path),
      mimetype: file.mimeType || file.mimetype,
      size: file.size,
    };
  }

  private async attachPresignedUrl(member: any) {
    if (!member) return member;
    const obj =
      typeof member.toObject === 'function' ? member.toObject() : member;
    if (obj.avatar) {
      if (obj.avatar.objectName) {
        obj.avatar.url = await this.minioService.getPresignedUrl(
          obj.avatar.objectName,
        );
      } else if (obj.avatar.filename && obj.avatar.filename.includes('/')) {
        obj.avatar.path = await this.minioService.getPresignedUrl(
          obj.avatar.filename,
        );
      }
    }
    if (obj.organization?.banner?.objectName) {
      obj.organization.banner.url = await this.minioService.getPresignedUrl(
        obj.organization.banner.objectName,
      );
    }
    if (obj.profileFile?.filename) {
      if (obj.profileFile.filename.includes('/')) {
        const presignedUrl = await this.minioService.getPresignedUrl(
          obj.profileFile.filename,
        );
        obj.profileFile.path = presignedUrl;
      }
    }
    if (obj.certificateFile?.filename) {
      if (obj.certificateFile.filename.includes('/')) {
        const presignedUrl = await this.minioService.getPresignedUrl(
          obj.certificateFile.filename,
        );
        obj.certificateFile.path = presignedUrl;
      }
    }
    if (obj.certificateFilePng?.filename) {
      if (obj.certificateFilePng.filename.includes('/')) {
        const presignedUrl = await this.minioService.getPresignedUrl(
          obj.certificateFilePng.filename,
        );
        obj.certificateFilePng.path = presignedUrl;
      }
    }
    if (obj.certificateFileJpg?.filename) {
      if (obj.certificateFileJpg.filename.includes('/')) {
        const presignedUrl = await this.minioService.getPresignedUrl(
          obj.certificateFileJpg.filename,
        );
        obj.certificateFileJpg.path = presignedUrl;
      }
    }
    return obj;
  }

  private async attachPresignedUrlToList(members: any[]) {
    return Promise.all(members.map((m) => this.attachPresignedUrl(m)));
  }

  async register(userId: string, registerDto: RegisterMemberDto) {
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

      let profileFile = null;
      if (registerDto.profileFile) {
        const uploadResult = await this.minioService.uploadFile(
          registerDto.profileFile,
          'members/files',
        );
        profileFile = this.toPublicFile(uploadResult);
      }

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
        profileFile,
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

      const memberWithUrl = await this.attachPresignedUrl(member);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get member profile successfully',
        content: {
          member: memberWithUrl,
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

  private async buildUpdateData(
    updateMemberDto: UpdateMemberDto,
  ): Promise<any> {
    const updateData: any = {};

    const directStringFields = [
      'memberCode',
      'name',
      'email',
      'phone',
      'certificateNumber',
      'workplace',
      'district',
      'address',
      'identityCode',
      'job',
      'position',
      'introduceBy',
      'memberType',
      'paymentMethod',
      'status',
      'rejectReason',
      'starRating',
      'tenure',
      'tag',
    ];

    directStringFields.forEach((field) => {
      if ((updateMemberDto as any)[field] !== undefined) {
        updateData[field] = (updateMemberDto as any)[field];
      }
    });

    if (updateMemberDto.professionalCertificationNumber !== undefined) {
      updateData.certificateNumber = updateMemberDto.professionalCertificationNumber;
    }

    if (updateMemberDto.isProfessionalCertification !== undefined) {
      updateData.isProfessionalCertification =
        String(
          updateMemberDto.isProfessionalCertification,
        ).toLowerCase() === 'true';
    }

    if (updateMemberDto.isFeatured !== undefined) {
      updateData.isFeatured =
        String(updateMemberDto.isFeatured).toLowerCase() === 'true';
    }

    if (updateMemberDto.isActive !== undefined) {
      updateData.isActive =
        String(updateMemberDto.isActive).toLowerCase() === 'true';
    }

    if (
      updateMemberDto.cpeHours !== undefined &&
      updateMemberDto.cpeHours !== null &&
      (updateMemberDto as any).cpeHours !== ''
    ) {
      updateData.cpeHours = Number(updateMemberDto.cpeHours);
    }

    if (
      updateMemberDto.featuredOrder !== undefined &&
      updateMemberDto.featuredOrder !== null &&
      (updateMemberDto as any).featuredOrder !== ''
    ) {
      updateData.featuredOrder = Number(updateMemberDto.featuredOrder);
    }

    if (
      updateMemberDto.dateOfBirth !== undefined &&
      updateMemberDto.dateOfBirth
    ) {
      updateData.dateOfBirth = new Date(updateMemberDto.dateOfBirth);
    }

    if (updateMemberDto.expiredAt !== undefined) {
      updateData.expiredAt = updateMemberDto.expiredAt
        ? new Date(updateMemberDto.expiredAt)
        : null;
    }

    const orgFieldsMap: Record<string, string> = {
      organizationName: 'name',
      companyName: 'name',
      organizationTaxCode: 'taxCode',
      organizationEmployeeScale: 'employeeScale',
      organizationLicense: 'license',
      companyLicense: 'license',
      organizationWebsiteUrl: 'websiteUrl',
      companyWebsiteUrl: 'websiteUrl',
      organizationPhoneNumber: 'phoneNumber',
      companyPhoneNumber: 'phoneNumber',
      organizationJobType: 'jobType',
      companyJobType: 'jobType',
      organizationSlogan: 'slogan',
      companySlogan: 'slogan',
    };

    Object.entries(orgFieldsMap).forEach(([dtoKey, schemaKey]) => {
      if ((updateMemberDto as any)[dtoKey] !== undefined) {
        updateData[`organization.${schemaKey}`] = (updateMemberDto as any)[
          dtoKey
        ];
      }
    });

    if (updateMemberDto.avatarFile) {
      const uploadResult = await this.minioService.uploadFile(
        updateMemberDto.avatarFile,
        'members/avatars',
      );
      updateData.avatar = this.toPublicFile(uploadResult);
    }

    if (updateMemberDto.bannerFile) {
      const uploadResult = await this.minioService.uploadFile(
        updateMemberDto.bannerFile,
        'members/banners',
      );
      updateData['organization.banner'] = this.toPublicFile(uploadResult);
    }

    if (updateMemberDto.profileFile) {
      const uploadResult = await this.minioService.uploadFile(
        updateMemberDto.profileFile,
        'members/files',
      );
      updateData.profileFile = this.toPublicFile(uploadResult);
    }

    if (updateMemberDto.certificateFile) {
      const uploadResult = await this.minioService.uploadFile(
        updateMemberDto.certificateFile,
        'members/certificates',
      );
      updateData.certificateFile = this.toPublicFile(uploadResult);
    }

    return updateData;
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

      const updateData = await this.buildUpdateData(updateMemberDto);

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

      const memberWithUrl = await this.attachPresignedUrl(member);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update member profile successfully',
        content: {
          member: memberWithUrl,
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

  async adminUpdate(id: string, updateMemberDto: UpdateMemberDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid member id',
          content: null,
        };
      }

      const updateData = await this.buildUpdateData(updateMemberDto);

      const member = await this.memberModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
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

      const memberWithUrl = await this.attachPresignedUrl(member);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Admin update member profile successfully',
        content: {
          member: memberWithUrl,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while admin updating member profile: ${error.message}`,
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
        status: MemberStatus.ACTIVE,
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

      const itemsWithUrls = await this.attachPresignedUrlToList(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get member directory successfully',
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
        message: `There is a problem while getting member directory: ${error.message}`,
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
          message: 'Invalid member id',
          content: null,
        };
      }

      const deleted = await this.memberModel.findByIdAndDelete(id);

      if (!deleted) {
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
        message: 'Delete member profile successfully',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting member profile: ${error.message}`,
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

      const itemsWithUrls = await this.attachPresignedUrlToList(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get admin member list successfully',
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
        message: `There is a problem while getting admin member list: ${error.message}`,
        content: null,
      };
    }
  }

  async findHomepage(query: QueryMemberHomepageDto) {
    try {
      const limit = query.limit || 6;
      const filter: any = {
        isActive: true,
        status: MemberStatus.ACTIVE,
      };

      if (query.isFeatured !== undefined) {
        filter.isFeatured = query.isFeatured;
      }

      if (query.memberType) {
        filter.memberType = query.memberType;
      }

      const members = await this.memberModel
        .find(filter)
        .populate({
          path: 'userId',
          select: 'name email role',
        })
        .sort({ isFeatured: -1, featuredOrder: 1, createdAt: -1 })
        .limit(limit);

      const membersWithUrls = await this.attachPresignedUrlToList(members);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get homepage members successfully',
        content: {
          members: membersWithUrls,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting homepage members: ${error.message}`,
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
