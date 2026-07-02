import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { MembershipType } from '../../../utils/membership-type.enum';

export class QueryMembershipRegistrationDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên hội viên / địa chỉ' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: MembershipType })
  @IsOptional()
  @IsEnum(MembershipType)
  memberType?: MembershipType;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
