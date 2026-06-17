import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateLegalDocCategoryDto {
  @ApiPropertyOptional({
    example: 'Chính sách thuế',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Các bài viết liên quan đến chính sách thuế mới',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
