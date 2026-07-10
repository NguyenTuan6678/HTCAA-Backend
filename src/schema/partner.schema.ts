import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PartnerDocument = HydratedDocument<Partner>;

// File metadata for logo/banner, giống NewsFile / MembershipFile,
// để lưu đủ thông tin (objectName, bucket, mimetype, size...) thay vì chỉ 1 string.
@Schema({ _id: false })
export class PartnerFile {
  @Prop({ type: String, required: true })
  originalName: string;

  @Prop({ type: String, required: true })
  objectName: string;

  @Prop({ type: String, required: true })
  bucket: string;

  @Prop({ type: String, required: true })
  mimetype: string;

  @Prop({ type: Number, required: true })
  size: number;

  url?: string | null;
}

export const PartnerFileSchema = SchemaFactory.createForClass(PartnerFile);

@Schema({ timestamps: true, collection: 'partners' })
export class Partner {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: PartnerFileSchema, default: null })
  logo?: PartnerFile | null;

  @Prop({ type: PartnerFileSchema, default: null })
  banner?: PartnerFile | null;

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
