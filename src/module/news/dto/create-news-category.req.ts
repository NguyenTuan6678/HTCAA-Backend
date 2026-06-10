import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNewsCategoryDto {
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
}
