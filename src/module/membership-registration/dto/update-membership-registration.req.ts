import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { MembershipType } from '../../../utils/membership-type.enum';

export class UpdateMembershipRegistrationDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn An' })
  @IsString()
  @IsOptional()
  name: string;

  @ApiPropertyOptional({
    enum: MembershipType,
    example: MembershipType.INDIVIDUAL,
  })
  @IsEnum(MembershipType)
  @IsOptional()
  memberType: MembershipType;

  @ApiPropertyOptional({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @IsString()
  @IsOptional()
  address: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsString()
  @IsOptional()
  taxCode: string;

  @ApiPropertyOptional({ example: '012345678901' })
  @IsString()
  @IsOptional()
  identityCode: string;

  @ApiPropertyOptional({ example: 'Kế toán viên' })
  @IsString()
  @IsOptional()
  job: string;

  @ApiPropertyOptional({ example: 'Trưởng phòng' })
  @IsString()
  @IsOptional()
  position: string;

  @ApiPropertyOptional({ example: '1995-10-15' })
  @IsDateString()
  @IsOptional()
  dateOfBirth: string;

  @ApiPropertyOptional({ example: '0900000000' })
  @IsString()
  @IsOptional()
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'an.nguyen@example.com' })
  @IsEmail()
  @IsOptional()
  email: string;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isProfessionalCertification: boolean;

  @ApiPropertyOptional({ example: 'CCT-123456' })
  @IsString()
  @IsNotEmpty()
  professionalCertificationNumber: string;

  @ApiPropertyOptional({ example: 'Công ty TNHH Kế toán ABC' })
  @IsString()
  @IsOptional()
  companyName: string;

  @ApiPropertyOptional({ example: 'http://example.com/license.pdf' })
  @IsOptional()
  @IsString()
  companyLicense?: string;

  @ApiPropertyOptional({ example: 'https://abc-accounting.vn' })
  @IsOptional()
  @IsString()
  companyWebsiteUrl?: string;

  @ApiPropertyOptional({ example: '02812345678' })
  @IsOptional()
  @IsString()
  companyPhoneNumber?: string;

  @ApiPropertyOptional({ example: 'Dịch vụ Tài chính' })
  @IsOptional()
  @IsString()
  companyJobType?: string;

  @ApiPropertyOptional({ example: 'Nơi khởi nguồn thành công' })
  @IsOptional()
  @IsString()
  companySlogan?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn B giới thiệu' })
  @IsOptional()
  @IsString()
  introduceBy?: string;

  @ApiPropertyOptional({
    example: '5',
    description: 'Star rating for the membership registration',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  starRating?: string | null;

  @ApiPropertyOptional({
    example: '2026-2028',
    description: 'Tenure / term of membership',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  tenure?: string | null;

  @ApiPropertyOptional({
    example: 'Vip',
    description: 'Tag or label for the membership registration',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  tag?: string | null;

  @IsOptional()
  avatarFile?: any;

  @IsOptional()
  bannerFile?: any;
}
