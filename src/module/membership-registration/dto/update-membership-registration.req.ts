import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMembershipRegistrationDto {
  @ApiPropertyOptional({
    example: '5',
    description: 'Star rating for the membership registration',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  starRating?: string | null;

  @ApiPropertyOptional({
    example: '2026-2028',
    description: 'Tenure / term of membership',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  tenure?: string | null;

  @ApiPropertyOptional({
    example: 'Vip',
    description: 'Tag or label for the membership registration',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  tag?: string | null;
}
