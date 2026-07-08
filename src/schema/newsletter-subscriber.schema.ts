import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NewsletterSubscriberDocument =
  HydratedDocument<NewsletterSubscriber>;

@Schema({ timestamps: true, collection: 'newsletter_subscribers' })
export class NewsletterSubscriber {
  @Prop({ type: String, required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ type: Boolean, default: false })
  confirmed: boolean;

  @Prop({ type: Date, default: Date.now })
  subscribedAt: Date;

  @Prop({ type: String, default: null })
  confirmationToken?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const NewsletterSubscriberSchema =
  SchemaFactory.createForClass(NewsletterSubscriber);

NewsletterSubscriberSchema.index({ email: 1 }, { unique: true });
NewsletterSubscriberSchema.index({ confirmationToken: 1 });
NewsletterSubscriberSchema.index({ createdAt: -1 });
