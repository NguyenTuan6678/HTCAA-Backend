import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @ApiPropertyOptional({
    example: '665f1e8d7c1b2a0012a12345',
    description: 'Category id (from legal_docs_categories collection)',
  })
  @Transform(({ value }) =>
    value === '' || value === 'null' || value === 'undefined'
      ? undefined
      : value,
  )
  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ example: 'Báo cáo tài chính quý 1 2026' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'Báo cáo tổng hợp doanh thu và chi phí quý 1',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'The .xlsx file to upload',
  })
  @IsOptional()
  file?: any;
}
