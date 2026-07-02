import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

import { MembershipType } from '../../../utils/membership-type.enum';

export class CreateMembershipRegistrationDto {
  @ApiProperty({ example: 'Công ty TNHH Kế toán ABC' })
  @IsString()
  @IsNotEmpty()
  memberName: string;

  @ApiProperty({ enum: MembershipType, example: MembershipType.ORGANIZATION })
  @IsEnum(MembershipType)
  @IsNotEmpty()
  memberType: MembershipType;

  @ApiProperty({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({
    example: 'Chuyên cung cấp dịch vụ kế toán, kiểm toán cho SME',
  })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'https://abc-accounting.vn' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ example: '1900 1234' })
  @IsOptional()
  @IsString()
  hotline?: string;

  @ApiPropertyOptional({ example: 'contact@abc-accounting.vn' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
