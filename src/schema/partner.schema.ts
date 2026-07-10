import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PartnerDocument = HydratedDocument<Partner>;

@Schema({ timestamps: true, collection: 'partners' })
export class Partner {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true })
  logo: string;

  @Prop({ type: String, default: null })
  banner?: string | null;

  @Prop({ type: String, required: true, trim: true })
  tagline: string;

  @Prop({ type: String, required: true, trim: true })
  description: string;

  @Prop({ type: Number, required: true, index: true })
  displayOrder: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);

// Double-ensure sorting index
PartnerSchema.index({ displayOrder: 1, isActive: 1 });
