import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

import { SocialPlatform } from '../../../schema/social-post.schema';

export class CreateSocialPostDto {
  @ApiProperty({
    enum: SocialPlatform,
    example: SocialPlatform.FACEBOOK,
  })
  @IsEnum(SocialPlatform)
  @IsNotEmpty()
  platform: SocialPlatform;

  @ApiProperty({
    example: 'Giới thiệu về Hiệp hội đại lý thuế TP.HCM (HTCAA)',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'https://facebook.com/htcaa/posts/123456789',
  })
  @IsUrl()
  @IsString()
  @IsNotEmpty()
  postUrl: string;

  @ApiPropertyOptional({
    example:
      'https://miniostorage.minvoicehcm.vn/htcaa/social-posts/thumbnail.png',
  })
  @IsString()
  @IsOptional()
  thumbnailImage?: string;

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
