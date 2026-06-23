import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFaqDto {
  @ApiPropertyOptional({
    description: 'Category id (from faq_categories collection)',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Làm thế nào để đăng ký tài khoản?' })
  @IsString()
  @IsOptional()
  question?: string;

  @ApiPropertyOptional({
    example: 'Bạn có thể đăng ký bằng cách nhấn vào nút Đăng ký.',
  })
  @IsString()
  @IsOptional()
  answer?: string;
}
