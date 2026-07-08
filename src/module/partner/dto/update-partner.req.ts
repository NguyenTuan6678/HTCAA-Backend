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
    example: 'partners/logos/m-invoice.png',
  })
  @IsString()
  @IsOptional()
  logo?: string;

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
