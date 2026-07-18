import { IsArray, IsNotEmpty, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestSupplementDto {
  @ApiProperty({
    example: ['avatar', 'taxCode'],
    description: 'List of fields that are missing or require corrections',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  missingFields: string[];

  @ApiProperty({
    example:
      'Ảnh chân dung không rõ nét, mã số thuế không trùng khớp với cơ quan thuế.',
    description: 'Detailed instructions from administrator on what to correct',
  })
  @IsNotEmpty()
  @IsString()
  adminNotes: string;
}
