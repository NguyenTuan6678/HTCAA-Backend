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

@ApiTags('Membership Registration')
@Controller('membership-registrations')
export class MembershipRegistrationController {
  constructor(
    private readonly membershipRegistrationService: MembershipRegistrationService,
  ) {}

  @Get('homepage')
  @ApiOperation({
    summary: 'Get membership registrations for homepage display',
  })
  findHomepage(@Query() query: QueryMembershipRegistrationDto) {
    return this.membershipRegistrationService.findHomepage(query);
  }

  @Get('check-exists')
  @ApiOperation({
    summary: 'Public: check if email or phone number is already registered',
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
  confirmPayment(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.membershipRegistrationService.confirmPayment(id, dto);
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
        starRating: { type: 'string', example: '5' },
        tenure: { type: 'string', example: '2026-2028' },
        tag: { type: 'string', example: 'Vip' },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Optional new avatar image file',
        },
        banner: {
          type: 'string',
          format: 'binary',
          description: 'Optional new banner image file',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      'Admin/editor: update a membership registration entry (rating, tenure, tag, avatar, banner)',
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
