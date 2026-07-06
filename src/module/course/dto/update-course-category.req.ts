import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCourseCategoryDto {
  @ApiPropertyOptional({
    example: 'Kế toán doanh nghiệp',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'ke-toan-doanh-nghiep',
  })
  @IsString()
  @IsOptional()
  slug?: string;

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
