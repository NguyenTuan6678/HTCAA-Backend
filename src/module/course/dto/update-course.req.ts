import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { CourseStatus } from '../../../utils/course-status.enum';

export class UpdateCourseDto {
  @ApiPropertyOptional({
    example: 'Cập nhật chính sách thuế GTGT năm 2026',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: '2026-06-15T08:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'Hội trường HTCAA',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: 'offline',
    description: 'Course learning type, for example: offline, online, hybrid',
  })
  @IsOptional()
  @IsString()
  learningType?: string;

  @ApiPropertyOptional({
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cpeHours?: number;

  @ApiPropertyOptional({
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxHours?: number;

  @ApiPropertyOptional({
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accountingHours?: number;

  @ApiPropertyOptional({
    example: 60,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalSeats?: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Current registered seats',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  registeredSeats?: number;

  @ApiPropertyOptional({
    enum: CourseStatus,
    example: CourseStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}
