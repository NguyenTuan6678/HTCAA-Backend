import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { News } from './news.schema';
import { User } from './user.schema';

export type NewsCommentDocument = HydratedDocument<NewsComment>;

@Schema({
  timestamps: true,
  collection: 'news_comments',
})
export class NewsComment {
  @Prop({ type: Types.ObjectId, ref: News.name, required: true })
  newsId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  content: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const NewsCommentSchema = SchemaFactory.createForClass(NewsComment);

NewsCommentSchema.index({ newsId: 1 });
NewsCommentSchema.index({ userId: 1 });
NewsCommentSchema.index({ createdAt: -1 });
