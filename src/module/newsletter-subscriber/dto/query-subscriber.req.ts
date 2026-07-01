import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QuerySubscriberDto {
  @ApiPropertyOptional({
    example: 'subscriber@example.com',
    description: 'Search by subscriber email',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by confirmation status',
  })
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsOptional()
  confirmed?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @Transform(({ value }) => Number(value ?? 1))
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ value }) => Number(value ?? 20))
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
