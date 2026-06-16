import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LegalDocStatus } from '../../../schema/legal-docs.schema';

export class QueryLegalDocDto {
  @ApiPropertyOptional({ example: 'hợp đồng' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ example: 'Hợp đồng' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    enum: LegalDocStatus,
    example: LegalDocStatus.PUBLISHED,
  })
  @IsEnum(LegalDocStatus)
  @IsOptional()
  status?: LegalDocStatus;

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
