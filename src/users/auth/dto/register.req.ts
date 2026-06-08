import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterAccountDto {
  @ApiProperty({ example: 'tuanNd', description: 'username', type: String })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'minvoice', description: 'password', type: String })
  @IsString()
  @IsNotEmpty()
  password: string;
}
