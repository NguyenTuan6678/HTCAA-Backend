import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLegalDocDto {
  @ApiPropertyOptional({
    example: '665f1e8d7c1b2a0012a12345',
    description: 'Category id (from legal_docs_categories collection)',
  })
  @IsMongoId()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ example: 'Hợp đồng lao động 2026' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Hợp đồng' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    type: 'object',
    properties: {
      objectName: { type: 'string' },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
    },
  })
  @IsOptional()
  file?: any;
}
