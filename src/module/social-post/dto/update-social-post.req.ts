import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

import { SocialPlatform } from '../../../schema/social-post.schema';

export class UpdateSocialPostDto {
  @ApiPropertyOptional({
    enum: SocialPlatform,
    example: SocialPlatform.FACEBOOK,
  })
  @IsEnum(SocialPlatform)
  @IsOptional()
  platform?: SocialPlatform;

  @ApiPropertyOptional({
    example: 'Giới thiệu về Hiệp hội đại lý thuế TP.HCM (HTCAA)',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'https://facebook.com/htcaa/posts/123456789',
  })
  @IsUrl()
  @IsString()
  @IsOptional()
  postUrl?: string;

  @ApiPropertyOptional({
    type: 'object',
    description:
      'Metadata file thumbnail mới (lấy từ kết quả upload). Nếu chỉ muốn thay ảnh, nên dùng POST /social-posts/:id/thumbnail thay vì gửi field này.',
    properties: {
      objectName: { type: 'string' },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
    },
  })
  @IsOptional()
  thumbnailImage?: any;

  @ApiPropertyOptional({
    example: '2026-07-06T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  publishedDate?: string;

  @ApiPropertyOptional({
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
