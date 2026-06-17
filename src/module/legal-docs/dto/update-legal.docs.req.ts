import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { LegalDocStatus } from '../../../schema/legal-docs.schema';

export class UpdateLegalDocDto {
  @ApiPropertyOptional({
    example: '665f1e8d7c1b2a0012a12345',
    description: 'Category id (from legal_docs_categories collection)',
  })
  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Hợp đồng lao động 2026 (cập nhật)' })
  @IsString()
  @IsOptional()
  title?: string;

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
}
