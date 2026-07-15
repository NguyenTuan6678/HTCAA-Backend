import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type MembershipRegistrationSupplementDocument = MembershipRegistrationSupplement & Document;

@Schema({ timestamps: true })
export class MembershipRegistrationSupplement {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'MembershipRegistration', required: true })
  registrationId: Types.ObjectId;

  @Prop({ type: [String], required: true })
  missingFields: string[];

  @Prop({ type: String, required: true, trim: true })
  adminNotes: string;

  @Prop({
    type: String,
    enum: ['pending', 'submitted', 'resolved'],
    default: 'pending',
    required: true,
  })
  status: string;

  @Prop({ type: Date, default: null })
  resolvedAt?: Date | null;
}

export const MembershipRegistrationSupplementSchema = 
  SchemaFactory.createForClass(MembershipRegistrationSupplement);
