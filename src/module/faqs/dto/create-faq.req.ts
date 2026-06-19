import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFaqDto {
  @ApiPropertyOptional({
    description: 'Category id (from legal_docs_categories collection)',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ example: 'Làm thế nào để đăng ký tài khoản?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    example:
      'Bạn có thể đăng ký bằng cách nhấn vào nút Đăng ký ở góc trên bên phải.',
  })
  @IsString()
  @IsNotEmpty()
  answer: string;
}
