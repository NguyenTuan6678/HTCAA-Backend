import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({
    example: '665f1e8d7c1b2a0012a12345',
    description: 'News category id',
  })
  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    example: 'Cập nhật chính sách thuế 2026',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'Tóm tắt ngắn về chính sách thuế mới...',
  })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({
    example: '<p>Nội dung bài viết...</p>',
    description:
      'Temporary content as string. PDF/file content will be handled later.',
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
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;

    if (typeof value === 'string') {

      return [value];
    }

    return value;
  })
  tags?: string[];

  @ApiPropertyOptional({
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  thumbnail?: any;

  @ApiPropertyOptional()
  @IsOptional()
  images?: any;
}
