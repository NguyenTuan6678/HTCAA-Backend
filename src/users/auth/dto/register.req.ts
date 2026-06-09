import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterAccountDto {
  @ApiProperty({ example: 'Tuan Nguyen', description: 'name', type: String })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'tuanNd@example.com',
    description: 'email',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123123', description: 'password', type: String })
  @IsString()
  @IsNotEmpty()
  password: string;
}
