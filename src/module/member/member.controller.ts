import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';

import { Role } from '../../utils/role.enum';
import { MemberService } from './member.service';
import { RegisterMemberDto } from './dto/register-member.req';
import { UpdateMemberDto } from './dto/update-member.req';
import { QueryMemberDirectoryDto } from './dto/query-member-directory.req';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { QueryAdminMemberDto } from './dto/query-admin-member.req';

const pdfFileFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const isPdf =
    file.mimetype === 'application/pdf' ||
    extname(file.originalname).toLowerCase() === '.pdf';

  if (!isPdf) {
    return callback(
      new BadRequestException('Only PDF files are allowed') as any,
      false,
    );
  }

  callback(null, true);
};

@ApiTags('Member')
@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  // @Post('register')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('authorization')
  // @ApiOperation({ summary: 'Register member profile' })
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       name: { type: 'string', example: 'Nguyễn Văn An' },
  //       dateOfBirth: { type: 'string', example: '1998-01-01' },
  //       email: { type: 'string', example: 'user@example.com' },
  //       phone: { type: 'string', example: '0900000000' },
  //       certificateNumber: { type: 'string', example: 'ĐLTCC-0001/TCT' },
  //       workplace: { type: 'string', example: 'Công ty ABC' },
  //       district: { type: 'string', example: 'Quận 1' },
  //       memberType: {
  //         type: 'string',
  //         enum: ['individual', 'organization'],
  //         example: 'individual',
  //       },
  //       paymentMethod: {
  //         type: 'string',
  //         enum: ['vnpay', 'bank'],
  //         example: 'bank',
  //       },
  //       organizationName: {
  //         type: 'string',
  //         example: 'Công ty TNHH Tư vấn Thuế ABC',
  //       },
  //       organizationTaxCode: {
  //         type: 'string',
  //         example: '0123456789',
  //       },
  //       organizationEmployeeScale: {
  //         type: 'string',
  //         example: '2–5 người',
  //       },
  //       profileFile: {
  //         type: 'string',
  //         format: 'binary',
  //         description: 'Optional PDF file, max 5MB',
  //       },
  //     },
  //     required: [
  //       'name',
  //       'dateOfBirth',
  //       'email',
  //       'phone',
  //       'certificateNumber',
  //       'memberType',
  //       'paymentMethod',
  //     ],
  //   },
  // })
  // @UseInterceptors(
  //   FileInterceptor('profileFile', {
  //     storage: memoryStorage(),
  //     fileFilter: pdfFileFilter,
  //     limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  //   }),
  // )
  // register(
  //   @Body() registerMemberDto: RegisterMemberDto,
  //   @UploadedFile() file: Express.Multer.File,
  //   @CurrentUser('id') userId: string,
  // ) {
  //   if (file) {
  //     registerMemberDto.profileFile = file;
  //   }
  //   return this.memberService.register(userId, registerMemberDto);
  // }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Get my member profile' })
  me(@CurrentUser('id') userId: string) {
    return this.memberService.me(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Update my member profile' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
        { name: 'profileFile', maxCount: 1 },
        { name: 'certificateFile', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 30 * 1024 * 1024 },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        // ── Personal & Professional Information ────────────────────────────
        memberCode: { type: 'string', example: 'HTCAA-0001', description: 'Member code' },
        name: { type: 'string', example: 'John Doe', description: 'Full name' },
        dateOfBirth: { type: 'string', example: '1998-01-01', description: 'Date of birth (YYYY-MM-DD)' },
        email: { type: 'string', example: 'user@example.com', description: 'Email address' },
        phone: { type: 'string', example: '0900000000', description: 'Contact phone number' },
        identityCode: { type: 'string', example: '079123456789', description: 'National ID / Passport number' },
        certificateNumber: { type: 'string', example: 'ĐLTCC-0001/TCT', description: 'Professional / Tax agent certificate number' },
        professionalCertificationNumber: { type: 'string', example: 'ĐLTCC-0001/TCT', description: 'Professional certification number (alias for certificateNumber)' },
        workplace: { type: 'string', example: 'ABC Accounting Co., Ltd.', description: 'Workplace' },
        district: { type: 'string', example: 'District 1', description: 'District / Region' },
        address: { type: 'string', example: '123 Main Street, District 1, Ho Chi Minh City', description: 'Contact address' },
        job: { type: 'string', example: 'Chief Accountant', description: 'Occupation / Job title' },
        position: { type: 'string', example: 'Department Head', description: 'Position / Title' },
        isProfessionalCertification: { type: 'boolean', example: true, description: 'Whether the member holds a professional certification' },
        introduceBy: { type: 'string', example: 'Jane Smith', description: 'Referrer / Introduced by' },
        starRating: { type: 'string', example: '5', description: 'Star rating (1–5)' },
        tenure: { type: 'string', example: '2026-2028', description: 'Membership tenure / term' },
        tag: { type: 'string', example: 'VIP', description: 'Classification tag or label' },

        // ── Membership Settings & Types ────────────────────────────────────
        memberType: {
          type: 'string',
          enum: ['individual', 'collective', 'affiliate'],
          example: 'individual',
          description: 'Membership type',
        },
        paymentMethod: {
          type: 'string',
          enum: ['bank', 'vnpay'],
          example: 'bank',
          description: 'Payment method',
        },

        // ── Organization Information ─────────────────────────────────────────────
        organizationName: { type: 'string', example: 'ABC Accounting Co., Ltd.', description: 'Organization / Company name' },
        companyName: { type: 'string', example: 'ABC Accounting Co., Ltd.', description: 'Company name (alias for organizationName)' },
        organizationTaxCode: { type: 'string', example: '0312345678', description: 'Organization tax identification number' },
        organizationEmployeeScale: { type: 'string', example: '10-20 employees', description: 'Organization employee scale' },
        organizationLicense: { type: 'string', example: '0312345678-GP', description: 'Business license number' },
        companyLicense: { type: 'string', example: '0312345678-GP', description: 'Business license (alias for organizationLicense)' },
        organizationWebsiteUrl: { type: 'string', example: 'https://abc.com', description: 'Organization website URL' },
        companyWebsiteUrl: { type: 'string', example: 'https://abc.com', description: 'Company website URL (alias for organizationWebsiteUrl)' },
        organizationPhoneNumber: { type: 'string', example: '02812345678', description: 'Organization phone number' },
        companyPhoneNumber: { type: 'string', example: '02812345678', description: 'Company phone number (alias for organizationPhoneNumber)' },
        organizationJobType: { type: 'string', example: 'Tax & Accounting Advisory', description: 'Industry / Business sector' },
        companyJobType: { type: 'string', example: 'Tax & Accounting Advisory', description: 'Industry / Business sector (alias for organizationJobType)' },
        organizationSlogan: { type: 'string', example: 'Trust & Dedication', description: 'Organization slogan' },
        companySlogan: { type: 'string', example: 'Trust & Dedication', description: 'Company slogan (alias for organizationSlogan)' },

        // ── Status & Admin Management ─────────────────────────────────────
        status: {
          type: 'string',
          enum: ['pending', 'active', 'rejected', 'expired', 'renewal_pending', 'cancelled'],
          example: 'active',
          description: 'Member status',
        },
        cpeHours: { type: 'number', example: 20, description: 'CPE training hours / credits' },
        isFeatured: { type: 'boolean', example: true, description: 'Whether to mark member as featured' },
        featuredOrder: { type: 'number', example: 1, description: 'Display priority order for featured member' },
        expiredAt: { type: 'string', example: '2027-12-31T23:59:59.000Z', description: 'Membership expiration date (ISO 8601)' },
        rejectReason: { type: 'string', example: 'Application requirements not met', description: 'Rejection reason' },
        isActive: { type: 'boolean', example: true, description: 'Active status of member profile' },

        // ── File Attachments ───────────────────────────────────────────────
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file',
        },
        banner: {
          type: 'string',
          format: 'binary',
          description: 'Organization banner image file',
        },
        profileFile: {
          type: 'string',
          format: 'binary',
          description: 'Member profile document file (PDF)',
        },
        certificateFile: {
          type: 'string',
          format: 'binary',
          description: 'Certificate document file (PDF)',
        },
      },
    },
  })
  updateMe(
    @Body() updateMemberDto: UpdateMemberDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
      profileFile?: Express.Multer.File[];
      certificateFile?: Express.Multer.File[];
    },
    @CurrentUser('id') userId: string,
  ) {
    if (files?.avatar?.[0]) updateMemberDto.avatarFile = files.avatar[0];
    if (files?.banner?.[0]) updateMemberDto.bannerFile = files.banner[0];
    if (files?.profileFile?.[0]) updateMemberDto.profileFile = files.profileFile[0];
    if (files?.certificateFile?.[0]) updateMemberDto.certificateFile = files.certificateFile[0];

    return this.memberService.updateMe(userId, updateMemberDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin update member profile' })
  @ApiParam({ name: 'id', description: 'Member id' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
        { name: 'profileFile', maxCount: 1 },
        { name: 'certificateFile', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 30 * 1024 * 1024 },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        // ── Personal & Professional Information ────────────────────────────
        memberCode: { type: 'string', example: 'HTCAA-0001', description: 'Member code' },
        name: { type: 'string', example: 'John Doe', description: 'Full name' },
        dateOfBirth: { type: 'string', example: '1998-01-01', description: 'Date of birth (YYYY-MM-DD)' },
        email: { type: 'string', example: 'user@example.com', description: 'Email address' },
        phone: { type: 'string', example: '0900000000', description: 'Contact phone number' },
        identityCode: { type: 'string', example: '079123456789', description: 'National ID / Passport number' },
        certificateNumber: { type: 'string', example: 'ĐLTCC-0001/TCT', description: 'Professional / Tax agent certificate number' },
        professionalCertificationNumber: { type: 'string', example: 'ĐLTCC-0001/TCT', description: 'Professional certification number (alias for certificateNumber)' },
        workplace: { type: 'string', example: 'ABC Accounting Co., Ltd.', description: 'Workplace' },
        district: { type: 'string', example: 'District 1', description: 'District / Region' },
        address: { type: 'string', example: '123 Main Street, District 1, Ho Chi Minh City', description: 'Contact address' },
        job: { type: 'string', example: 'Chief Accountant', description: 'Occupation / Job title' },
        position: { type: 'string', example: 'Department Head', description: 'Position / Title' },
        isProfessionalCertification: { type: 'boolean', example: true, description: 'Whether the member holds a professional certification' },
        introduceBy: { type: 'string', example: 'Jane Smith', description: 'Referrer / Introduced by' },
        starRating: { type: 'string', example: '5', description: 'Star rating (1–5)' },
        tenure: { type: 'string', example: '2026-2028', description: 'Membership tenure / term' },
        tag: { type: 'string', example: 'VIP', description: 'Classification tag or label' },

        // ── Membership Settings & Types ────────────────────────────────────
        memberType: {
          type: 'string',
          enum: ['individual', 'collective', 'affiliate'],
          example: 'individual',
          description: 'Membership type',
        },
        paymentMethod: {
          type: 'string',
          enum: ['bank', 'vnpay'],
          example: 'bank',
          description: 'Payment method',
        },

        // ── Organization Information ─────────────────────────────────────────────
        organizationName: { type: 'string', example: 'ABC Accounting Co., Ltd.', description: 'Organization / Company name' },
        companyName: { type: 'string', example: 'ABC Accounting Co., Ltd.', description: 'Company name (alias for organizationName)' },
        organizationTaxCode: { type: 'string', example: '0312345678', description: 'Organization tax identification number' },
        organizationEmployeeScale: { type: 'string', example: '10-20 employees', description: 'Organization employee scale' },
        organizationLicense: { type: 'string', example: '0312345678-GP', description: 'Business license number' },
        companyLicense: { type: 'string', example: '0312345678-GP', description: 'Business license (alias for organizationLicense)' },
        organizationWebsiteUrl: { type: 'string', example: 'https://abc.com', description: 'Organization website URL' },
        companyWebsiteUrl: { type: 'string', example: 'https://abc.com', description: 'Company website URL (alias for organizationWebsiteUrl)' },
        organizationPhoneNumber: { type: 'string', example: '02812345678', description: 'Organization phone number' },
        companyPhoneNumber: { type: 'string', example: '02812345678', description: 'Company phone number (alias for organizationPhoneNumber)' },
        organizationJobType: { type: 'string', example: 'Tax & Accounting Advisory', description: 'Industry / Business sector' },
        companyJobType: { type: 'string', example: 'Tax & Accounting Advisory', description: 'Industry / Business sector (alias for organizationJobType)' },
        organizationSlogan: { type: 'string', example: 'Trust & Dedication', description: 'Organization slogan' },
        companySlogan: { type: 'string', example: 'Trust & Dedication', description: 'Company slogan (alias for organizationSlogan)' },

        // ── Status & Admin Management ─────────────────────────────────────
        status: {
          type: 'string',
          enum: ['pending', 'active', 'rejected', 'expired', 'renewal_pending', 'cancelled'],
          example: 'active',
          description: 'Member status',
        },
        cpeHours: { type: 'number', example: 20, description: 'CPE training hours / credits' },
        isFeatured: { type: 'boolean', example: true, description: 'Whether to mark member as featured' },
        featuredOrder: { type: 'number', example: 1, description: 'Display priority order for featured member' },
        expiredAt: { type: 'string', example: '2027-12-31T23:59:59.000Z', description: 'Membership expiration date (ISO 8601)' },
        rejectReason: { type: 'string', example: 'Application requirements not met', description: 'Rejection reason' },
        isActive: { type: 'boolean', example: true, description: 'Active status of member profile' },

        // ── File Attachments ───────────────────────────────────────────────
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file',
        },
        banner: {
          type: 'string',
          format: 'binary',
          description: 'Organization banner image file',
        },
        profileFile: {
          type: 'string',
          format: 'binary',
          description: 'Member profile document file (PDF)',
        },
        certificateFile: {
          type: 'string',
          format: 'binary',
          description: 'Certificate document file (PDF)',
        },
      },
    },
  })
  adminUpdate(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
      profileFile?: Express.Multer.File[];
      certificateFile?: Express.Multer.File[];
    },
  ) {
    if (files?.avatar?.[0]) updateMemberDto.avatarFile = files.avatar[0];
    if (files?.banner?.[0]) updateMemberDto.bannerFile = files.banner[0];
    if (files?.profileFile?.[0]) updateMemberDto.profileFile = files.profileFile[0];
    if (files?.certificateFile?.[0]) updateMemberDto.certificateFile = files.certificateFile[0];

    return this.memberService.adminUpdate(id, updateMemberDto);
  }

  @Get('directory')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Get member directory (requires login)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  directory(@Query() query: QueryMemberDirectoryDto) {
    return this.memberService.directory(query);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin get all member profiles' })
  adminFindAll(@Query() query: QueryAdminMemberDto) {
    return this.memberService.adminFindAll(query);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Delete member profile' })
  @ApiParam({ name: 'id', description: 'Member id' })
  delete(@Param('id') id: string) {
    return this.memberService.delete(id);
  }
}
