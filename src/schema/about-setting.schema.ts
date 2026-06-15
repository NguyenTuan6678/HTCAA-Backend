import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ─── Shared ───────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class SectionHeader {
  @Prop() eyebrow: string;
  @Prop() title: string;
  @Prop() description: string;
}

// ─── Leadership ───────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class LeadershipCta {
  @Prop() label: string;
  @Prop() href: string;
}

@Schema({ _id: false })
export class LeadershipItem {
  @Prop() image: string;
  @Prop() initials: string;
  @Prop() role: string;
  @Prop() name: string;
  @Prop() bio: string;
  @Prop({ default: false }) isPresident: boolean;
}

@Schema({ _id: false })
export class LeadershipSection {
  @Prop({ type: SectionHeader }) header: SectionHeader;
  @Prop({ type: [LeadershipItem], default: [] }) items: LeadershipItem[];
  @Prop({ type: LeadershipCta, required: false }) cta?: LeadershipCta;
}

// ─── Mission ──────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class MissionItem {
  @Prop() title: string;
  @Prop() description: string;
  @Prop() icon: string;
}

@Schema({ _id: false })
export class MissionSection {
  @Prop({ type: SectionHeader }) header: SectionHeader;
  @Prop({ type: [MissionItem], default: [] }) items: MissionItem[];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class StatItem {
  @Prop() value: string;
  @Prop() label: string;
}

@Schema({ _id: false })
export class StatsSection {
  @Prop({ type: SectionHeader }) header: SectionHeader;
  @Prop({ type: [StatItem], default: [] }) items: StatItem[];
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class TimelineItem {
  @Prop() year: string;
  @Prop() title: string;
  @Prop() description: string;
}

@Schema({ _id: false })
export class TimelineHighlight {
  @Prop() eyebrow: string;
  @Prop() title: string;
  @Prop() description: string;
}

@Schema({ _id: false })
export class TimelineSection {
  @Prop({ type: SectionHeader }) header: SectionHeader;
  @Prop({ type: [TimelineItem], default: [] }) items: TimelineItem[];
  @Prop({ type: [TimelineHighlight], default: [] })
  highlights: TimelineHighlight[];
}

// ─── Root Document ────────────────────────────────────────────────────────────

@Schema({ timestamps: true, collection: 'about_us' })
export class AboutUs extends Document {
  @Prop() description: string;
  @Prop() company_name: string;
  @Prop() logo: string;
  @Prop() email: string;
  @Prop() address: string;
  @Prop() phone: string;
  @Prop() map: string;
  @Prop() tag: string;
  @Prop() facebook_link: string;
  @Prop() youtube_link: string;
  @Prop() zalo_link: string;

  @Prop({ type: LeadershipSection }) leadership: LeadershipSection;
  @Prop({ type: MissionSection }) mission: MissionSection;
  @Prop({ type: StatsSection }) stats: StatsSection;
  @Prop({ type: TimelineSection }) timeline: TimelineSection;
}

export const AboutUsSchema = SchemaFactory.createForClass(AboutUs);
