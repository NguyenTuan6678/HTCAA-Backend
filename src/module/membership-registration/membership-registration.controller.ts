import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Sse,
  MessageEvent,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Observable, map } from 'rxjs';

import { Role } from '../../utils/role.enum';
import { CurrentUser } from '../../users/auth/decorators/current-user.decorator';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { MembershipRegistrationService } from './membership-registration.service';
import { CreateMembershipRegistrationDto } from './dto/create-membership-registration.req';
import { QueryMembershipRegistrationDto } from './dto/query-membership-registration.req';
import { UpdateMembershipRegistrationDto } from './dto/update-membership-registration.req';
import { CheckExistsDto } from './dto/check-exists.req';
import { ConfirmPaymentDto } from './dto/confirm-payment.req';
import { CustomCertificateDto } from './dto/custom-certificate.req';
import { RequestSupplementDto } from './dto/request-supplement.req';

@ApiTags('Membership Registration')
@Controller('membership-registrations')
export class MembershipRegistrationController {
  constructor(
    private readonly membershipRegistrationService: MembershipRegistrationService,
  ) { }

  @Get('homepage')
  @ApiOperation({
    summary: 'Get membership registrations for homepage display',
  })
  findHomepage(@Query() query: QueryMembershipRegistrationDto) {
    return this.membershipRegistrationService.findHomepage(query);
  }

  @Get('check-exists')
  @ApiOperation({
    summary:
      'Public: check if email, phone number, taxCode, or identityCode is already registered',
  })
  checkExists(@Query() query: CheckExistsDto) {
    return this.membershipRegistrationService.checkExists(query);
  }

  @Sse('notifications/stream')
  @ApiOperation({
    summary:
      'Admin/editor: SSE stream for real-time registration notifications',
  })
  streamNotifications(): Observable<MessageEvent> {
    return this.membershipRegistrationService
      .getNotificationStream()
      .pipe(map((data) => ({ data }) as MessageEvent));
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
        { name: 'attachments', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Nguyễn Văn An' },
        memberType: {
          type: 'string',
          enum: ['individual', 'collective', 'affiliate'],
          example: 'individual',
        },
        address: { type: 'string', example: '123 Nguyễn Huệ, Quận 1, TP.HCM' },
        taxCode: { type: 'string', example: '0123456789' },
        identityCode: { type: 'string', example: '012345678901' },
        job: { type: 'string', example: 'Kế toán viên' },
        position: { type: 'string', example: 'Trưởng phòng' },
        dateOfBirth: { type: 'string', example: '1995-10-15' },
        phoneNumber: { type: 'string', example: '0900000000' },
        email: { type: 'string', example: 'an.nguyen@example.com' },
        isProfessionalCertification: { type: 'boolean', example: true },
        professionalCertificationNumber: {
          type: 'string',
          example: 'CCT-123456',
        },
        companyName: { type: 'string', example: 'Công ty TNHH Kế toán ABC' },
        companyLicense: {
          type: 'string',
          example: 'https://example.com/license.pdf',
        },
        companyWebsiteUrl: {
          type: 'string',
          example: 'https://abc-accounting.vn',
        },
        companyPhoneNumber: { type: 'string', example: '02812345678' },
        companyJobType: { type: 'string', example: 'Dịch vụ Tài chính' },
        companySlogan: { type: 'string', example: 'Nơi khởi nguồn thành công' },
        introduceBy: { type: 'string', example: 'Nguyễn Văn B giới thiệu' },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Required avatar image file',
        },
        banner: {
          type: 'string',
          format: 'binary',
          description: 'Optional banner image file',
        },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Attachments (PDF, PNG, JPG files, max 5MB/file)',
        },
      },
      required: [
        'name',
        'memberType',
        'address',
        'identityCode',
        'job',
        'position',
        'dateOfBirth',
        'phoneNumber',
        'email',
        'isProfessionalCertification',
      ],
    },
  })
  @ApiOperation({ summary: 'Public: submit membership registration form' })
  create(
    @Body() dto: CreateMembershipRegistrationDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
      attachments?: Express.Multer.File[];
    },
  ) {
    if (!files?.avatar?.[0]) {
      throw new BadRequestException('Ảnh đại diện (avatar) là bắt buộc.');
    }

    return this.membershipRegistrationService.create(dto, {
      avatar: files.avatar[0],
      banner: files.banner?.[0],
      attachments: files.attachments || [],
    });
  }

  @Get('supplement/:token')
  @ApiOperation({
    summary:
      'Public: get registration details to supplement missing info/files',
  })
  @ApiParam({ name: 'token', description: 'Supplementation secure token' })
  getSupplement(@Param('token') token: string) {
    return this.membershipRegistrationService.getSupplementByToken(token);
  }

  @Patch('supplement/:token')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
        { name: 'attachments', maxCount: 10 },
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
        name: { type: 'string' },
        memberType: {
          type: 'string',
          enum: ['individual', 'collective', 'affiliate'],
        },
        address: { type: 'string' },
        taxCode: { type: 'string' },
        identityCode: { type: 'string' },
        job: { type: 'string' },
        position: { type: 'string' },
        dateOfBirth: { type: 'string' },
        phoneNumber: { type: 'string' },
        email: { type: 'string' },
        isProfessionalCertification: { type: 'boolean' },
        professionalCertificationNumber: { type: 'string' },
        companyName: { type: 'string' },
        companyLicense: { type: 'string' },
        companyWebsiteUrl: { type: 'string' },
        companyPhoneNumber: { type: 'string' },
        companyJobType: { type: 'string' },
        companySlogan: { type: 'string' },
        introduceBy: { type: 'string' },
        avatar: { type: 'string', format: 'binary' },
        banner: { type: 'string', format: 'binary' },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Public: supplement files/info using secure token',
  })
  @ApiParam({ name: 'token', description: 'Supplementation secure token' })
  updateSupplement(
    @Param('token') token: string,
    @Body() dto: UpdateMembershipRegistrationDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
      attachments?: Express.Multer.File[];
    },
  ) {
    return this.membershipRegistrationService.updateSupplementByToken(
      token,
      dto,
      {
        avatar: files?.avatar?.[0],
        banner: files?.banner?.[0],
        attachments: files?.attachments || [],
      },
    );
  }

  @Patch(':id/request-supplement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Admin/editor: request supplementation of missing/invalid info or files',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  @ApiBody({ type: RequestSupplementDto })
  requestSupplement(
    @Param('id') id: string,
    @Body() dto: RequestSupplementDto,
  ) {
    return this.membershipRegistrationService.requestSupplement(id, dto);
  }

  @Get('supplements/:recordId')
  @ApiOperation({
    summary:
      'Public: get registration details to supplement missing info/files using supplement record ID',
  })
  @ApiParam({
    name: 'recordId',
    description: 'Supplement record ID (ObjectId)',
  })
  getSupplementByRecordId(@Param('recordId') recordId: string) {
    return this.membershipRegistrationService.getSupplementByRecordId(recordId);
  }

  @Patch('supplements/:recordId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
        { name: 'attachments', maxCount: 10 },
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
        name: { type: 'string' },
        memberType: {
          type: 'string',
          enum: ['individual', 'collective', 'affiliate'],
        },
        address: { type: 'string' },
        taxCode: { type: 'string' },
        identityCode: { type: 'string' },
        job: { type: 'string' },
        position: { type: 'string' },
        dateOfBirth: { type: 'string' },
        phoneNumber: { type: 'string' },
        email: { type: 'string' },
        isProfessionalCertification: { type: 'boolean' },
        professionalCertificationNumber: { type: 'string' },
        companyName: { type: 'string' },
        companyLicense: { type: 'string' },
        companyWebsiteUrl: { type: 'string' },
        companyPhoneNumber: { type: 'string' },
        companyJobType: { type: 'string' },
        companySlogan: { type: 'string' },
        introduceBy: { type: 'string' },
        avatar: { type: 'string', format: 'binary' },
        banner: { type: 'string', format: 'binary' },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Public: supplement files/info using supplement record ID',
  })
  @ApiParam({
    name: 'recordId',
    description: 'Supplement record ID (ObjectId)',
  })
  updateSupplementByRecordId(
    @Param('recordId') recordId: string,
    @Body() dto: UpdateMembershipRegistrationDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
      attachments?: Express.Multer.File[];
    },
  ) {
    return this.membershipRegistrationService.updateSupplementByRecordId(
      recordId,
      dto,
      {
        avatar: files?.avatar?.[0],
        banner: files?.banner?.[0],
        attachments: files?.attachments || [],
      },
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor: get list of membership registrations',
  })
  findAll(@Query() query: QueryMembershipRegistrationDto) {
    return this.membershipRegistrationService.findAll(query);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor: remove a membership registration entry',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  delete(@Param('id') id: string) {
    return this.membershipRegistrationService.delete(id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor: approve a membership registration entry',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  approve(@Param('id') id: string) {
    return this.membershipRegistrationService.approve(id);
  }

  @Post(':id/resend-payment-notification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Admin/editor: resend payment notification email for approved registration',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  resendPaymentNotification(@Param('id') id: string) {
    return this.membershipRegistrationService.resendPaymentNotification(id);
  }

  @Patch(':id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Admin/editor: reconcile and confirm payment for membership registration',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  @ApiBody({ type: ConfirmPaymentDto })
  confirmPayment(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.membershipRegistrationService.confirmPayment(
      id,
      dto,
      adminUserId,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
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
        // ── Personal information ──────────────────────────────────────────
        name: {
          type: 'string',
          example: 'John Doe',
          description: 'Full name',
        },
        memberType: {
          type: 'string',
          enum: ['individual', 'collective', 'affiliate'],
          example: 'individual',
          description: 'Membership type',
        },
        address: {
          type: 'string',
          example: '123 Main Street, District 1, Ho Chi Minh City',
          description: 'Residential address',
        },
        taxCode: {
          type: 'string',
          example: '0123456789',
          description: 'Tax identification number',
        },
        identityCode: {
          type: 'string',
          example: '012345678901',
          description: 'National ID / Passport number',
        },
        job: {
          type: 'string',
          example: 'Accountant',
          description: 'Occupation',
        },
        position: {
          type: 'string',
          example: 'Department Head',
          description: 'Job title / position',
        },
        dateOfBirth: {
          type: 'string',
          example: '1995-10-15',
          description: 'Date of birth (ISO 8601)',
        },
        phoneNumber: {
          type: 'string',
          example: '0900000000',
          description: 'Personal phone number',
        },
        email: {
          type: 'string',
          example: 'john.doe@example.com',
          description: 'Email address',
        },
        isProfessionalCertification: {
          type: 'boolean',
          example: true,
          description: 'Whether the member holds a professional certification',
        },
        professionalCertificationNumber: {
          type: 'string',
          example: 'CCT-123456',
          description: 'Professional certification number',
        },
        // ── Company information ───────────────────────────────────────────
        companyName: {
          type: 'string',
          example: 'ABC Accounting Co., Ltd.',
          description: 'Company name',
        },
        companyLicense: {
          type: 'string',
          example: 'https://example.com/license.pdf',
          description: 'Business license URL',
        },
        companyWebsiteUrl: {
          type: 'string',
          example: 'https://abc-accounting.com',
          description: 'Company website URL',
        },
        companyPhoneNumber: {
          type: 'string',
          example: '02812345678',
          description: 'Company phone number',
        },
        companyJobType: {
          type: 'string',
          example: 'Financial Services',
          description: 'Industry / business sector',
        },
        companySlogan: {
          type: 'string',
          example: 'Where success begins',
          description: 'Company slogan',
        },
        introduceBy: {
          type: 'string',
          example: 'Referred by Jane Smith',
          description: 'Referrer name',
        },
        // ── Admin-only fields ─────────────────────────────────────────────
        starRating: {
          type: 'string',
          example: '5',
          description: 'Star rating (1–5)',
          nullable: true,
        },
        tenure: {
          type: 'string',
          example: '2026-2028',
          description: 'Membership tenure / term',
          nullable: true,
        },
        tag: {
          type: 'string',
          example: 'Vip',
          description: 'Classification tag or label',
          nullable: true,
        },
        // ── File uploads ──────────────────────────────────────────────────
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'New avatar image (optional)',
        },
        banner: {
          type: 'string',
          format: 'binary',
          description: 'New banner image (optional)',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      'Admin/editor: update a membership registration entry (all fields supported)',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipRegistrationDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    },
  ) {
    if (files?.avatar?.[0]) {
      dto.avatarFile = files.avatar[0];
    }

    if (files?.banner?.[0]) {
      dto.bannerFile = files.banner[0];
    }

    return this.membershipRegistrationService.update(id, dto);
  }

  @Post('certificates/preview')
  @ApiOperation({
    summary:
      'Public/Admin: Generate dynamic preview of certificate (PDF, PNG, JPG as base64) with custom coordinates and text overrides',
  })
  @ApiBody({ type: CustomCertificateDto })
  previewCustomCertificate(@Body() dto: CustomCertificateDto) {
    return this.membershipRegistrationService.previewCustomCertificate(dto);
  }

  @Get('certificates/preview')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="certificate_preview.pdf"')
  @ApiOperation({
    summary: 'Public: Preview certificate dynamically as PDF stream',
  })
  async previewCustomCertificatePdf(
    @Query() query: any,
  ): Promise<StreamableFile> {
    const pdfBuffer =
      await this.membershipRegistrationService.previewCustomCertificatePdf(
        query,
      );
    return new StreamableFile(pdfBuffer);
  }

  @Get(':id/certificate/preview')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="certificate_preview.pdf"')
  @ApiOperation({
    summary: 'Public: Preview certificate PDF by registration ID as PDF stream',
  })
  @ApiParam({ name: 'id', description: 'Membership registration ID' })
  async previewCertificatePdfById(
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const pdfBuffer =
      await this.membershipRegistrationService.previewCertificatePdfById(id);
    return new StreamableFile(pdfBuffer);
  }
}
