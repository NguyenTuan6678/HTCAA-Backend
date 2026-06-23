import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFaqCategoryDto {
  @ApiProperty({
    example: 'Hóa đơn điện tử',
    description: 'FAQ category title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'invoice',
    description: 'FAQ category name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Các câu hỏi thường gặp về hóa đơn điện tử',
    description: 'FAQ category description',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
