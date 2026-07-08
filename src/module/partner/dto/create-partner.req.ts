import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({
    example: 'Tổng công ty M-Invoice',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'partners/logos/m-invoice.png',
    description: 'Logo object key or URL',
  })
  @IsString()
  @IsNotEmpty()
  logo: string;

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
