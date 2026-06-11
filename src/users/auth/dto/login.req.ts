import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginReqType {
  @ApiProperty({
    example: 'canhdongtuyet39@gmail.com',
    description: 'email',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '123123',
    description: 'password',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
