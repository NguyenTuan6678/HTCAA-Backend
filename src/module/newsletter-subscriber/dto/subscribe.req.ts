import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({
    example: 'subscriber@example.com',
    description: 'Email address of the newsletter subscriber',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
