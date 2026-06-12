import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CourseStatus } from '../../../utils/course-status.enum';

export class CreateCourseDto {
  @ApiProperty({
    example: 'Cập nhật chính sách thuế GTGT năm 2026',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: '2026-06-15T08:00:00.000Z',
  })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    example: 'Hội trường HTCAA',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: 'offline',
  })
  @IsOptional()
  @IsString()
  learningType?: string;

  @ApiPropertyOptional({
    example: 4,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cpeHours?: number;

  @ApiPropertyOptional({
    example: 4,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxHours?: number;

  @ApiPropertyOptional({
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accountingHours?: number;

  @ApiPropertyOptional({
    example: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalSeats?: number;

  @ApiPropertyOptional({
    enum: CourseStatus,
    example: CourseStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}
