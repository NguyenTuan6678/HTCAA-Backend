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
import { CourseType } from '../../../utils/course-type.enum';

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
    example: '4 giờ',
    description: 'Thời lượng khóa học (free-text)',
  })
  @IsOptional()
  @IsString()
  duration?: string;

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
    example: 500000,
    description: 'Học phí cho người chưa là hội viên (VND)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({
    example: 350000,
    description: 'Học phí ưu đãi cho hội viên (VND). Bắt buộc phải nhập',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  memberPrice: number;

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

  @ApiPropertyOptional({
    example: '60d5ec49f83f213b18cc2a91',
    description: 'Danh mục khóa học',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: CourseType,
    example: CourseType.OFFLINE,
  })
  @IsOptional()
  @IsEnum(CourseType)
  type?: CourseType;
}
