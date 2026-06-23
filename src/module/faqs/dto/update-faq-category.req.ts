import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFaqCategoryDto {
  @ApiPropertyOptional({
    example: 'Hóa đơn điện tử',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'invoice',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Các câu hỏi thường gặp về hóa đơn điện tử',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
