import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePartnerDto {
  @ApiPropertyOptional({
    example: 'Tổng công ty M-Invoice',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    type: 'object',
    description:
      'Metadata file logo mới (lấy từ kết quả upload). Nếu chỉ muốn thay ảnh, nên dùng POST /partners/:id/logo thay vì gửi field này.',
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
      'Metadata file banner mới (lấy từ kết quả upload). Nếu chỉ muốn thay ảnh, nên dùng POST /partners/:id/banner thay vì gửi field này.',
    properties: {
      objectName: { type: 'string' },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
    },
  })
  @IsOptional()
  banner?: any;

  @ApiPropertyOptional({
    example: 'Hệ thống hóa đơn điện tử hàng đầu',
  })
  @IsString()
  @IsOptional()
  tagline?: string;

  @ApiPropertyOptional({
    example:
      'Cung cấp giải pháp hóa đơn điện tử thông minh, kết nối trực tiếp cơ quan thuế.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
