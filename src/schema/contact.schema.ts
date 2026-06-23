import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ContactDocument = HydratedDocument<Contact>;

export enum ContactStatus {
  PENDING = 'Pending',
  REVIEWED = 'Reviewed',
  RESOLVED = 'Resolved',
}

@Schema({ timestamps: true, collection: 'contacts' })
export class Contact {
  @Prop({ type: String, required: true, trim: true })
  subject: string;

  @Prop({ type: String, required: true, trim: true })
  fullName: string;

  @Prop({ type: String, required: true, trim: true })
  phone: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ type: String, required: true, trim: true })
  content: string;

  @Prop({ type: String, enum: ContactStatus, default: ContactStatus.PENDING })
  status: ContactStatus;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

ContactSchema.index({ status: 1 });
ContactSchema.index({ email: 1 });
ContactSchema.index({ createdAt: -1 });
