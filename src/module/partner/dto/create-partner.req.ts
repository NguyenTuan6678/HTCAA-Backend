import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({
    example: 'Tổng công ty M-Invoice',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    type: 'object',
    description:
      'Metadata file logo (lấy từ kết quả upload). Có thể để trống lúc tạo và upload sau qua POST /partners/:id/logo.',
    properties: {
      objectName: { type: 'string' },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
    },
  })
  @IsOptional()
  logo?: any;

  @ApiPropertyOptional({
    type: 'object',
    description:
      'Metadata file banner (lấy từ kết quả upload). Có thể upload sau qua POST /partners/:id/banner.',
    properties: {
      objectName: { type: 'string' },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
    },
  })
  @IsOptional()
  banner?: any;

  @ApiProperty({
    example: 'Hệ thống hóa đơn điện tử hàng đầu',
  })
  @IsString()
  @IsNotEmpty()
  tagline: string;

  @ApiProperty({
    example:
      'Cung cấp giải pháp hóa đơn điện tử thông minh, kết nối trực tiếp cơ quan thuế.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
