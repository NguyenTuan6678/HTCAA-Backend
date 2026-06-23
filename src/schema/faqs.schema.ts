import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { FaqCategory } from './faq-category.schema';

export type FaqDocument = HydratedDocument<Faq>;

export enum FaqStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
}

@Schema({ timestamps: true, collection: 'faqs' })
export class Faq {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'FaqCategory', default: null })
  categoryId: Types.ObjectId | null;

  @Prop({ type: String, required: true, trim: true })
  question: string;

  @Prop({ type: String, required: true, trim: true })
  answer: string;

  @Prop({ type: String, enum: FaqStatus, default: FaqStatus.DRAFT })
  status: FaqStatus;

  @Prop({ type: Number, default: 0, min: 0 })
  likes: number;

  @Prop({ type: Number, default: 0, min: 0 })
  dislikes: number;

  // Track which users already liked/disliked to prevent duplicate votes
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likedBy: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  dislikedBy: Types.ObjectId[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);

FaqSchema.index({ status: 1 });
FaqSchema.index({ createdAt: -1 });
FaqSchema.index({ likes: -1 });
