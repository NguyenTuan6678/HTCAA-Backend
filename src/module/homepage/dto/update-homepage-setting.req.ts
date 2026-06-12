import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateHomepageSettingDto {
  @ApiPropertyOptional({
    description: 'SEO configuration',
    example: {
      title: 'HTCAA — Hội Tư vấn và Đại lý Thuế TP.HCM',
      description:
        'Cầu nối tin cậy giữa cơ quan thuế và cộng đồng doanh nghiệp TP.HCM.',
    },
  })
  @IsOptional()
  @IsObject()
  seo?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  topbar?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  header?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  hero?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  heroStats?: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  ctaCards?: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  trustStrip?: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  quickServices?: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  presidentQuote?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  socialHub?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  finalCta?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  footer?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
