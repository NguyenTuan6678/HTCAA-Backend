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
import { CourseType } from '../../../utils/course-type.enum';

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
    example:
      '<p>Khóa học cập nhật các điểm mới trong <strong>chính sách thuế GTGT</strong> năm 2026...</p>',
    description:
      'Tóm tắt/giới thiệu khóa học. Chấp nhận HTML để FE tự trình bày (in đậm, xuống dòng, danh sách...).',
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({
    type: 'object',
    description:
      'Metadata file ảnh khóa học mới (lấy từ kết quả upload). Nếu chỉ muốn thay ảnh, nên dùng POST /courses/:id/image thay vì gửi field này.',
    properties: {
      objectName: { type: 'string' },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
    },
  })
  @IsOptional()
  image?: any;

  @ApiPropertyOptional({
    example: 'offline',
    description: 'Course learning type, for example: offline, online, hybrid',
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
    example: 500000,
    description: 'Học phí cho người chưa là hội viên (VND)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    example: 350000,
    description:
      'Học phí ưu đãi cho hội viên (VND). Bỏ trống nếu không có giá riêng',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  memberPrice?: number;

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
