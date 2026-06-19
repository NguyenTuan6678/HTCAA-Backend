import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTypeCategoryDto {
  @ApiProperty({ example: 'Hợp đồng lao động 2026' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Hợp đồng' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
