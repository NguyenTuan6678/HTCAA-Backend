import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCourseCategoryDto {
  @ApiProperty({
    example: 'Kế toán doanh nghiệp',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'ke-toan-doanh-nghiep',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({
    example: 'Các khóa học về kế toán, chuẩn mực kế toán doanh nghiệp.',
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
