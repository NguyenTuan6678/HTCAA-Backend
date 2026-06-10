import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateNewsDto {
  @ApiPropertyOptional({
    example: '665f1e8d7c1b2a0012a12345',
    description: 'News category id',
  })
  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Cập nhật chính sách thuế 2026',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'Tóm tắt ngắn về chính sách thuế mới...',
  })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({
    example: '<p>Nội dung bài viết...</p>',
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    example: ['thuế', 'chính sách'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
