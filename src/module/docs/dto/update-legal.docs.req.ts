import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LegalDocStatus } from '../../../schema/legal-docs.schema';

export class UpdateLegalDocDto {
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
