import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn An' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '1998-01-01' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '0900000000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'ĐLTCC-0001/TCT' })
  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @ApiPropertyOptional({ example: 'Công ty ABC' })
  @IsString()
  @IsOptional()
  workplace?: string;

  @ApiPropertyOptional({ example: 'Quận 1' })
  @IsString()
  @IsOptional()
  district?: string;
}
