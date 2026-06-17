import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFaqDto {
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
