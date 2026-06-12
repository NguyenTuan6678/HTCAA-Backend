import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HomepageSettingDocument = HydratedDocument<HomepageSetting>;

@Schema({ timestamps: true, collection: 'homepage_settings' })
export class HomepageSetting {
  @Prop({
    type: String,
    required: true,
    default: 'homepage',
  })
  key: string;

  @Prop({ type: Object, default: {} })
  seo: Record<string, any>;

  @Prop({ type: Object, default: {} })
  topbar: Record<string, any>;

  @Prop({ type: Object, default: {} })
  header: Record<string, any>;

  @Prop({ type: Object, default: {} })
  hero: Record<string, any>;

  @Prop({ type: Array, default: [] })
  heroStats: Record<string, any>[];

  @Prop({ type: Array, default: [] })
  ctaCards: Record<string, any>[];

  @Prop({ type: Array, default: [] })
  trustStrip: Record<string, any>[];

  @Prop({ type: Array, default: [] })
  quickServices: Record<string, any>[];

  @Prop({ type: Object, default: {} })
  presidentQuote: Record<string, any>;

  @Prop({ type: Object, default: {} })
  socialHub: Record<string, any>;

  @Prop({ type: Object, default: {} })
  finalCta: Record<string, any>;

  @Prop({ type: Object, default: {} })
  footer: Record<string, any>;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const HomepageSettingSchema =
  SchemaFactory.createForClass(HomepageSetting);

HomepageSettingSchema.index({ key: 1 }, { unique: true });
HomepageSettingSchema.index({ isActive: 1 });
