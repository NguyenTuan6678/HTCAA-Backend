import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email to receive reset password link',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
