import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MemberStatus } from '../../../utils/member-status';

export class QueryAdminMemberDto {
  @ApiPropertyOptional({
    example: 'Nguyễn',
    description:
      'Search by name, email, phone, memberCode, certificateNumber or workplace',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    enum: MemberStatus,
    example: MemberStatus.PENDING,
  })
  @IsEnum(MemberStatus)
  @IsOptional()
  status?: MemberStatus;

  @ApiPropertyOptional({
    example: 'Quận 1',
  })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({
    example: 1,
  })
  @Transform(({ value }) => Number(value ?? 1))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
  })
  @Transform(({ value }) => Number(value ?? 20))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
