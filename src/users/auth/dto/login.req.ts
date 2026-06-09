import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginReqType {
  @ApiProperty({
    example: 'user@example.com',
    description: 'email',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'password',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
