import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NewsCategoryDocument = HydratedDocument<NewsCategory>;

@Schema({
  timestamps: true,
  collection: 'news_categories',
})
export class NewsCategory {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, trim: true })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const NewsCategorySchema = SchemaFactory.createForClass(NewsCategory);

NewsCategorySchema.index({ slug: 1 }, { unique: true });
NewsCategorySchema.index({ name: 1 });
NewsCategorySchema.index({ createdAt: -1 });
