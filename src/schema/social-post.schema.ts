import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SocialPostDocument = HydratedDocument<SocialPost>;

export enum SocialPlatform {
  FACEBOOK = 'facebook',
  YOUTUBE = 'youtube',
}

// File metadata for thumbnailImage, giống NewsFile / MembershipFile / PartnerFile,
// để lưu đủ thông tin (objectName, bucket, mimetype, size...) thay vì chỉ 1 string.
@Schema({ _id: false })
export class SocialPostFile {
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

export const SocialPostFileSchema =
  SchemaFactory.createForClass(SocialPostFile);

@Schema({ timestamps: true, collection: 'social_posts' })
export class SocialPost {
  @Prop({
    type: String,
    enum: SocialPlatform,
    required: true,
    index: true,
  })
  platform: SocialPlatform;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, required: true, trim: true })
  postUrl: string;

  @Prop({ type: SocialPostFileSchema, default: null })
  thumbnailImage?: SocialPostFile | null;

  @Prop({ type: Date, required: true })
  publishedDate: Date;

  @Prop({ type: Boolean, default: false, index: true })
  isPinned: boolean;

  @Prop({ type: Number, default: null })
  pinnedOrder?: number | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const SocialPostSchema = SchemaFactory.createForClass(SocialPost);

// Compound index for target queries in homepage: platform + isPinned + pinnedOrder
SocialPostSchema.index({ platform: 1, isPinned: 1, pinnedOrder: 1 });
