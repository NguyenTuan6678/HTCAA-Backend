import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LegalDocStatus } from '../../../schema/legal-docs.schema';

export class CreateLegalDocDto {
  @ApiProperty({ example: 'Hợp đồng lao động 2026' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Hợp đồng' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  file?: any; // Multer handles the actual value, we just whitelist the key
}
