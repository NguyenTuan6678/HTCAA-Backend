import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({
    example: 'Hỏi về biểu phí đăng ký thành viên',
    description: 'Subject of the inquiry',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Full name of the submitter',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: '0912345678',
    description: 'Phone number of the submitter',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'nguyenvana@example.com',
    description: 'Email of the submitter',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Tôi muốn tìm hiểu thêm về các quyền lợi khi đăng ký hội viên chính thức.',
    description: 'Detailed content of the question',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
