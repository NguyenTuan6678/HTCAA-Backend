import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FaqStatus } from '../../../schema/faqs.schema';

export class QueryFaqDto {
  @ApiPropertyOptional({ example: 'đăng ký' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by category id',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: FaqStatus, example: FaqStatus.PUBLISHED })
  @IsEnum(FaqStatus)
  @IsOptional()
  status?: FaqStatus;

  @ApiPropertyOptional({ example: 1 })
  @Transform(({ value }) => Number(value ?? 1))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ value }) => Number(value ?? 20))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
