import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class PinSocialPostDto {
  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isPinned: boolean;

  @ApiPropertyOptional({
    example: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  pinnedOrder?: number;
}
