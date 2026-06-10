import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class QueryNewsCommentDto {
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
