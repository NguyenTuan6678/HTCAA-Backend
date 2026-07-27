import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

import { MemberType } from '../../../utils/member-type.enum';

export class QueryMemberHomepageDto {
  @ApiPropertyOptional({
    example: 6,
    description: 'Number of members to display on homepage',
  })
  @Transform(({ value }) => Number(value ?? 6))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 6;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by featured members',
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    enum: MemberType,
    example: MemberType.INDIVIDUAL,
    description: 'Filter by member type',
  })
  @IsEnum(MemberType)
  @IsOptional()
  memberType?: MemberType;
}
