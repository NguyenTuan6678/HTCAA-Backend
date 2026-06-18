import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLegalDocCategoryDto {
  @ApiProperty({
    example: 'Tiêu đề chính sách thuế',
    description: 'Category title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Chính sách thuế',
    description: 'Category name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Các bài viết liên quan đến chính sách thuế mới',
    description: 'Category description',
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
