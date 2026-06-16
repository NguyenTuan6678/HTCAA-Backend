import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  file?: any;
}
