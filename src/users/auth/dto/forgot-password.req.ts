import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'canhdongtuyet39@gmail.com',
    description: 'email address of the user requesting password reset',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
