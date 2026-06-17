import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '../../schema/documents.schema';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ example: '665f1e8d7c1b2a0012a12345' })
  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Báo cáo tài chính quý 1 2026 (cập nhật)' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'Báo cáo tổng hợp doanh thu và chi phí quý 1',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: DocumentStatus,
    example: DocumentStatus.PUBLISHED,
  })
  @IsEnum(DocumentStatus)
  @IsOptional()
  status?: DocumentStatus;
}
