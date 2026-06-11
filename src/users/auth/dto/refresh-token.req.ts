import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    name: 'refreshToken',
    description: 'refresh token',
    type: String,
  })
  @IsString()
  @IsOptional()
  refreshToken: string;
}
