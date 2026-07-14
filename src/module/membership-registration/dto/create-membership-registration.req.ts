import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

import { MembershipType } from '../../../utils/membership-type.enum';

export class CreateMembershipRegistrationDto {
  @ApiProperty({ example: 'Nguyễn Văn An' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: MembershipType, example: MembershipType.INDIVIDUAL })
  @IsEnum(MembershipType)
  @IsNotEmpty()
  memberType: MembershipType;

  @ApiProperty({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({
    example: '0123456789',
    description: 'Required if memberType is collective',
  })
  @ValidateIf((o) => o.memberType === MembershipType.COLLECTIVE)
  @IsString()
  @IsNotEmpty()
  taxCode: string;

  @ApiProperty({ example: '012345678901' })
  @IsString()
  @IsNotEmpty()
  identityCode: string;

  @ApiProperty({ example: 'Kế toán viên' })
  @IsString()
  @IsNotEmpty()
  job: string;

  @ApiProperty({ example: 'Trưởng phòng' })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiProperty({ example: '1995-10-15' })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({ example: '0900000000' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'an.nguyen@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsNotEmpty()
  isProfessionalCertification: boolean;

  @ApiPropertyOptional({
    example: 'CCT-123456',
    description: 'Required if isProfessionalCertification is true',
  })
  @ValidateIf((o) => o.isProfessionalCertification === true)
  @IsString()
  @IsNotEmpty()
  professionalCertificationNumber: string;

  @ApiPropertyOptional({
    example: 'Công ty TNHH Kế toán ABC',
    description: 'Required if memberType is collective',
  })
  @ValidateIf((o) => o.memberType === MembershipType.COLLECTIVE)
  @IsString()
  @IsNotEmpty()
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

  @IsOptional()
  avatarFile?: any;

  @IsOptional()
  bannerFile?: any;
}
