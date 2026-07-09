import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from './user.schema';
import { NewsStatus } from '../utils/new-status.enum';
import { NewsCategory } from './news-category.schema';

export type NewsDocument = HydratedDocument<News>;

@Schema({ _id: false })
export class NewsFile {
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

export const NewsFileSchema = SchemaFactory.createForClass(NewsFile);

@Schema({
  timestamps: true,
  collection: 'news',
})
export class News {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: NewsCategory.name,
    required: true,
  })
  categoryId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, required: true, trim: true })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  summary?: string | null;

  @Prop({ type: String, default: null })
  content?: string | null;

  @Prop({ type: NewsFileSchema, default: null })
  thumbnail?: NewsFile | null;

  @Prop({ type: [NewsFileSchema], default: [] })
  images: NewsFile[];

  @Prop({
    type: String,
    enum: NewsStatus,
    default: NewsStatus.DRAFT,
    required: true,
  })
  status: NewsStatus;

  @Prop({ type: Date, default: null })
  publishedAt?: Date | null;

  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const NewsSchema = SchemaFactory.createForClass(News);

NewsSchema.index({ slug: 1 }, { unique: true });
NewsSchema.index({ status: 1 });
NewsSchema.index({ categoryId: 1 });
NewsSchema.index({ createdBy: 1 });
NewsSchema.index({ createdAt: -1 });
NewsSchema.index({ publishedAt: -1 });
NewsSchema.index({ title: 'text', summary: 'text', content: 'text' });
