import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class QueryNewsDto {
  @ApiPropertyOptional({
    example: '665f1e8d7c1b2a0012a12345',
  })
  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'chinh-sach-thue',
  })
  @IsString()
  @IsOptional()
  categorySlug?: string;

  @ApiPropertyOptional({
    example: 'thuế',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    example: 'chính sách',
  })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: 1,
  })
  @Transform(({ value }) => Number(value ?? 1))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
  })
  @Transform(({ value }) => Number(value ?? 10))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
