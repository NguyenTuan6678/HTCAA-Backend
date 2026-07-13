import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CheckExistsDto {
  @ApiPropertyOptional({ example: 'an.nguyen@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '0900000000' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
