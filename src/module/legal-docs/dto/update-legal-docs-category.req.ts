import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class UpdateLegalDocCategoryDto {
  @ApiPropertyOptional({
    example: 'Tiêu đề chính sách thuế',
    description: 'Category title',
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiPropertyOptional({
    example: 'Chính sách thuế',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Các bài viết liên quan đến chính sách thuế mới',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: '665f1e8d7c1b2a0012a12345',
    description: 'Category id (from category_types collection)',
  })
  @IsMongoId()
  @IsOptional()
  typeId?: string;
}
