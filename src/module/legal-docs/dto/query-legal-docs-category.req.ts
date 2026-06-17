import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class QueryLegalDocCategoryDto {
  @ApiPropertyOptional({
    example: 'thuế',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === 'true' || value === true;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 1,
  })
  @Transform(({ value }) => Number(value ?? 1))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
  })
  @Transform(({ value }) => Number(value ?? 20))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
