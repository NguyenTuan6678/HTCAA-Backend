import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelRegistrationDto {
  @ApiPropertyOptional({
    example: 'Trùng lịch công tác',
    description: 'Reason for cancelling the registration',
  })
  @IsString()
  @IsOptional()
  cancelReason?: string;
}
