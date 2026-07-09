import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

import { MemberType } from '../../../utils/member-type.enum';
import { PaymentMethod } from '../../../utils/payment-method.enum';

export class RegisterMemberDto {
  @ApiProperty({
    example: 'Nguyễn Văn An',
    description: 'Full name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '1998-01-01',
    description: 'Date of birth',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '0900000000',
    description: 'Phone number',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'ĐLTCC-0001/TCT',
    description: 'Tax agent certificate number',
  })
  @IsString()
  @IsNotEmpty()
  certificateNumber: string;

  @ApiPropertyOptional({
    example: 'Công ty ABC',
    description: 'Workplace',
  })
  @IsString()
  @IsOptional()
  workplace?: string;

  @ApiPropertyOptional({
    example: 'Quận 1',
    description: 'Working district',
  })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiProperty({
    enum: MemberType,
    example: MemberType.INDIVIDUAL,
    description: 'Member type',
  })
  @IsEnum(MemberType)
  @IsNotEmpty()
  memberType: MemberType;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.BANK,
    description: 'Payment method',
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    example: 'Công ty TNHH Tư vấn Thuế ABC',
    description: 'Organization name',
  })
  @ValidateIf((o) => o.memberType === MemberType.ORGANIZATION)
  @IsString()
  @IsNotEmpty()
  organizationName?: string;

  @ApiPropertyOptional({
    example: '0123456789',
    description: 'Organization tax code',
  })
  @ValidateIf((o) => o.memberType === MemberType.ORGANIZATION)
  @IsString()
  @IsNotEmpty()
  organizationTaxCode?: string;

  @ApiPropertyOptional({
    example: '2–5 người',
    description: 'Employee scale',
  })
  @IsString()
  @IsOptional()
  organizationEmployeeScale?: string;

  @ApiPropertyOptional({
    type: 'object',
    properties: {
      objectName: { type: 'string' },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
      url: { type: 'string' },
    },
  })
  @IsOptional()
  profileFile?: any;
}
