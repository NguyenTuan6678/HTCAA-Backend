import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    name: 'refreshToken',
    description: 'refresh token',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
