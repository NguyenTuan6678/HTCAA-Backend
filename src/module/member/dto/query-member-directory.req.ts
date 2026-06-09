import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryMemberDirectoryDto {
  @ApiPropertyOptional({
    example: 'Nguyễn',
    description:
      'Search by name, email, phone, certificate number or workplace',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    example: 'Quận 1',
    description: 'Filter by district',
  })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
  })
  @Transform(({ value }) => Number(value ?? 1))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Limit per page',
  })
  @Transform(({ value }) => Number(value ?? 20))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
