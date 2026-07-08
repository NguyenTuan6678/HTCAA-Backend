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

import { Role } from '../../utils/role/role';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';

import { MembershipRegistrationService } from './membership-registration.service';
import { CreateMembershipRegistrationDto } from './dto/create-membership-registration.req';
import { QueryMembershipRegistrationDto } from './dto/query-membership-registration.req';
import { UpdateMembershipRegistrationDto } from './dto/update-membership-registration.req';

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

  // Public — không cần đăng nhập, ai cũng điền được
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'logo', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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
          description: 'Optional company license document URL or number',
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
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Optional logo image file',
        },
      },
      required: [
        'name',
        'memberType',
        'address',
        'taxCode',
        'identityCode',
        'job',
        'position',
        'dateOfBirth',
        'phoneNumber',
        'email',
        'isProfessionalCertification',
        'professionalCertificationNumber',
        'companyName',
      ],
    },
  })
  @ApiOperation({ summary: 'Public: submit membership registration form' })
  create(
    @Body() dto: CreateMembershipRegistrationDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      logo?: Express.Multer.File[];
    },
  ) {
    if (!files?.avatar?.[0]) {
      throw new BadRequestException('Avatar file is required');
    }
    dto.avatarFile = files.avatar[0];

    if (files.logo?.[0]) {
      dto.logoFile = files.logo[0];
    }

    return this.membershipRegistrationService.create(dto);
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary:
      'Admin/editor: update a membership registration entry (rating, tenure, tag)',
  })
  @ApiParam({ name: 'id', description: 'Membership registration id' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipRegistrationDto,
  ) {
    return this.membershipRegistrationService.update(id, dto);
  }
}
