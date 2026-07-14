import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class TextComponentOverrideDto {
  @ApiProperty({ required: false, example: 421 })
  @IsOptional()
  @IsNumber()
  x?: number;

  @ApiProperty({ required: false, example: 295 })
  @IsOptional()
  @IsNumber()
  y?: number;

  @ApiProperty({ required: false, example: 22 })
  @IsOptional()
  @IsNumber()
  fontSize?: number;

  @ApiProperty({ required: false, example: 85 })
  @IsOptional()
  @IsNumber()
  paddingRight?: number;
}

class LayoutOverridesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  recipientName?: TextComponentOverrideDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  dateText?: TextComponentOverrideDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  decisionNumber?: TextComponentOverrideDto;
}

export class CustomCertificateDto {
  @ApiProperty({
    example: 'NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN QUÂN ĐỘI CHI NHÁNH PHÚ NHUẬN',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false, example: 'HTCAA-TT-2026-0001' })
  @IsOptional()
  @IsString()
  memberCode?: string;

  @ApiProperty({ required: false, example: 'individual' })
  @IsOptional()
  @IsString()
  memberType?: string;

  @ApiProperty({
    required: false,
    example: 'Thành phố Hồ Chí Minh, ngày 15 tháng 03 năm 2026',
  })
  @IsOptional()
  @IsString()
  customDateText?: string;

  @ApiProperty({ required: false, example: 'Số: .........' })
  @IsOptional()
  @IsString()
  customDecisionNumberText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  layout?: LayoutOverridesDto;
}
