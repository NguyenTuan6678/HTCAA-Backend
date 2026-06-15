import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Shared ───────────────────────────────────────────────────────────────────

export class SectionHeaderDto {
  @ApiProperty() @IsString() eyebrow: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
}

// ─── Leadership ───────────────────────────────────────────────────────────────

export class LeadershipCtaDto {
  @ApiProperty() @IsString() label: string;
  @ApiProperty() @IsString() href: string;
}

export class LeadershipItemDto {
  @ApiProperty() @IsString() image: string;
  @ApiProperty() @IsString() initials: string;
  @ApiProperty() @IsString() role: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() bio: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPresident?: boolean;
}

export class LeadershipSectionDto {
  @ApiProperty({ type: SectionHeaderDto })
  @ValidateNested()
  @Type(() => SectionHeaderDto)
  header: SectionHeaderDto;

  @ApiProperty({ type: [LeadershipItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadershipItemDto)
  items: LeadershipItemDto[];

  @ApiPropertyOptional({ type: LeadershipCtaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LeadershipCtaDto)
  cta?: LeadershipCtaDto;
}

// ─── Mission ──────────────────────────────────────────────────────────────────

export class MissionItemDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsString() icon: string;
}

export class MissionSectionDto {
  @ApiProperty({ type: SectionHeaderDto })
  @ValidateNested()
  @Type(() => SectionHeaderDto)
  header: SectionHeaderDto;

  @ApiProperty({ type: [MissionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MissionItemDto)
  items: MissionItemDto[];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export class StatItemDto {
  @ApiProperty() @IsString() value: string;
  @ApiProperty() @IsString() label: string;
}

export class StatsSectionDto {
  @ApiProperty({ type: SectionHeaderDto })
  @ValidateNested()
  @Type(() => SectionHeaderDto)
  header: SectionHeaderDto;

  @ApiProperty({ type: [StatItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatItemDto)
  items: StatItemDto[];
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export class TimelineItemDto {
  @ApiProperty() @IsString() year: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
}

export class TimelineHighlightDto {
  @ApiProperty() @IsString() eyebrow: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
}

export class TimelineSectionDto {
  @ApiProperty({ type: SectionHeaderDto })
  @ValidateNested()
  @Type(() => SectionHeaderDto)
  header: SectionHeaderDto;

  @ApiProperty({ type: [TimelineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimelineItemDto)
  items: TimelineItemDto[];

  @ApiProperty({ type: [TimelineHighlightDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimelineHighlightDto)
  highlights: TimelineHighlightDto[];
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export class UpdateAboutUsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() company_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() map?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tag?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() facebook_link?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() youtube_link?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zalo_link?: string;

  @ApiPropertyOptional({ type: LeadershipSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LeadershipSectionDto)
  leadership?: LeadershipSectionDto;

  @ApiPropertyOptional({ type: MissionSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MissionSectionDto)
  mission?: MissionSectionDto;

  @ApiPropertyOptional({ type: StatsSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatsSectionDto)
  stats?: StatsSectionDto;

  @ApiPropertyOptional({ type: TimelineSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimelineSectionDto)
  timeline?: TimelineSectionDto;
}
