import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import { MemberType } from '../../../utils/member-type.enum';
import { PaymentMethod } from '../../../utils/payment-method.enum';
import { MemberStatus } from '../../../utils/member-status.enum';

export class UpdateMemberDto {
  // ── Personal & Professional Information ──────────────────────────────────────────
  @ApiPropertyOptional({
    example: 'HTCAA-0001',
    description: 'Member code',
  })
  @IsString()
  @IsOptional()
  memberCode?: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Full name',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: '1998-01-01',
    description: 'Date of birth (ISO format YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: '0900000000',
    description: 'Contact phone number',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: '079123456789',
    description: 'National ID / Passport number',
  })
  @IsString()
  @IsOptional()
  identityCode?: string;

  @ApiPropertyOptional({
    example: 'ĐLTCC-0001/TCT',
    description: 'Professional / Tax agent certificate number',
  })
  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @ApiPropertyOptional({
    example: 'ABC Accounting Co., Ltd.',
    description: 'Workplace',
  })
  @IsString()
  @IsOptional()
  workplace?: string;

  @ApiPropertyOptional({
    example: 'District 1',
    description: 'District / Region',
  })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({
    example: '123 Main Street, District 1, Ho Chi Minh City',
    description: 'Contact address',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: 'Chief Accountant',
    description: 'Occupation / Job title',
  })
  @IsString()
  @IsOptional()
  job?: string;

  @ApiPropertyOptional({
    example: 'Department Head',
    description: 'Position / Title',
  })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the member holds a professional certification',
  })
  @IsBoolean()
  @IsOptional()
  isProfessionalCertification?: boolean;

  @ApiPropertyOptional({
    example: 'Jane Smith',
    description: 'Referrer / Introduced by',
  })
  @IsString()
  @IsOptional()
  introduceBy?: string;

  // ── Membership Settings & Types ────────────────────────────────────────────────
  @ApiPropertyOptional({
    enum: MemberType,
    example: MemberType.INDIVIDUAL,
    description: 'Membership type (individual, collective, affiliate)',
  })
  @IsEnum(MemberType)
  @IsOptional()
  memberType?: MemberType;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    example: PaymentMethod.BANK,
    description: 'Payment method (bank, vnpay)',
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  // ── Organization Information ────────────────────────────────────────────────────
  @ApiPropertyOptional({
    example: 'ABC Accounting Co., Ltd.',
    description: 'Organization / Company name',
  })
  @IsString()
  @IsOptional()
  organizationName?: string;

  @ApiPropertyOptional({
    example: '0312345678',
    description: 'Organization tax identification number',
  })
  @IsString()
  @IsOptional()
  organizationTaxCode?: string;

  @ApiPropertyOptional({
    example: '10-20 employees',
    description: 'Organization employee scale',
  })
  @IsString()
  @IsOptional()
  organizationEmployeeScale?: string;

  @ApiPropertyOptional({
    example: '0312345678-GP',
    description: 'Business license number',
  })
  @IsString()
  @IsOptional()
  organizationLicense?: string;

  @ApiPropertyOptional({
    example: 'https://abc.com',
    description: 'Organization website URL',
  })
  @IsString()
  @IsOptional()
  organizationWebsiteUrl?: string;

  @ApiPropertyOptional({
    example: '02812345678',
    description: 'Organization phone number',
  })
  @IsString()
  @IsOptional()
  organizationPhoneNumber?: string;

  @ApiPropertyOptional({
    example: 'Tax & Accounting Advisory',
    description: 'Industry / Business sector',
  })
  @IsString()
  @IsOptional()
  organizationJobType?: string;

  @ApiPropertyOptional({
    example: 'Trust & Dedication',
    description: 'Organization slogan',
  })
  @IsString()
  @IsOptional()
  organizationSlogan?: string;

  // ── Admin Management & Status Fields ───────────────────────────────────────────
  @ApiPropertyOptional({
    enum: MemberStatus,
    example: MemberStatus.ACTIVE,
    description:
      'Member status (pending, active, rejected, expired, renewal_pending, cancelled)',
  })
  @IsEnum(MemberStatus)
  @IsOptional()
  status?: MemberStatus;

  @ApiPropertyOptional({
    example: 20,
    description: 'CPE training hours / credits',
  })
  @IsNumber()
  @IsOptional()
  cpeHours?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to mark member as featured on homepage',
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display priority order for featured member',
  })
  @IsNumber()
  @IsOptional()
  featuredOrder?: number;

  @ApiPropertyOptional({
    example: '2027-12-31T23:59:59.000Z',
    description: 'Membership expiration date (ISO 8601 string)',
  })
  @IsDateString()
  @IsOptional()
  expiredAt?: string;

  @ApiPropertyOptional({
    example: 'Application requirements not met',
    description: 'Rejection reason if status is rejected',
  })
  @IsString()
  @IsOptional()
  rejectReason?: string;

  @ApiPropertyOptional({
    example: 'CCT-123456',
    description: 'Professional certification number (alias for certificateNumber)',
  })
  @IsString()
  @IsOptional()
  professionalCertificationNumber?: string;

  @ApiPropertyOptional({
    example: '5',
    description: 'Star rating (1–5)',
  })
  @IsString()
  @IsOptional()
  starRating?: string;

  @ApiPropertyOptional({
    example: '2026-2028',
    description: 'Membership tenure / term',
  })
  @IsString()
  @IsOptional()
  tenure?: string;

  @ApiPropertyOptional({
    example: 'VIP',
    description: 'Classification tag or label',
  })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({
    example: 'ABC Accounting Co., Ltd.',
    description: 'Company name (alias for organizationName)',
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({
    example: '0312345678-GP',
    description: 'Business license (alias for organizationLicense)',
  })
  @IsString()
  @IsOptional()
  companyLicense?: string;

  @ApiPropertyOptional({
    example: 'https://abc.com',
    description: 'Company website URL (alias for organizationWebsiteUrl)',
  })
  @IsString()
  @IsOptional()
  companyWebsiteUrl?: string;

  @ApiPropertyOptional({
    example: '02812345678',
    description: 'Company phone number (alias for organizationPhoneNumber)',
  })
  @IsString()
  @IsOptional()
  companyPhoneNumber?: string;

  @ApiPropertyOptional({
    example: 'Tax & Accounting Advisory',
    description: 'Industry / business sector (alias for organizationJobType)',
  })
  @IsString()
  @IsOptional()
  companyJobType?: string;

  @ApiPropertyOptional({
    example: 'Trust & Dedication',
    description: 'Company slogan (alias for organizationSlogan)',
  })
  @IsString()
  @IsOptional()
  companySlogan?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Active status of member profile',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // ── File Attachments ────────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Avatar image file',
  })
  @IsOptional()
  avatarFile?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Organization banner image file',
  })
  @IsOptional()
  bannerFile?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Member profile document file (PDF)',
  })
  @IsOptional()
  profileFile?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Certificate document file (PDF)',
  })
  @IsOptional()
  certificateFile?: any;
}
