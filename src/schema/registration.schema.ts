import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from './user.schema';
import { Member } from './member.schema';
import { Course } from './course.schema';
import {
  RegistrationStatus,
  RegistrationPaymentStatus,
} from '../utils/registration-status.enum';

export type RegistrationDocument = HydratedDocument<Registration>;

@Schema({ _id: false })
export class Registrant {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ type: String, required: true, trim: true })
  phoneNumber: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ type: String, required: true, trim: true })
  taxCodeActive: string;

  @Prop({ type: Date, required: true })
  taxCodeActiveDate: Date;

  @Prop({ type: Boolean, default: null })
  isMember?: boolean | null;

  @Prop({ type: Boolean, default: null })
  claimedIsMember?: boolean | null;

  @Prop({ type: String, required: true, trim: true })
  companyName: string;

  @Prop({ type: String, required: true, trim: true })
  taxId: string;

  @Prop({ type: String, required: true, trim: true })
  addressExportBill: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  emailExportBill: string;
}

export const RegistrantSchema = SchemaFactory.createForClass(Registrant);

@Schema({ timestamps: true, collection: 'registrations' })
export class Registration {
  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  userId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: Member.name, default: null })
  memberId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: Course.name, required: true })
  courseId: Types.ObjectId;

  @Prop({
    type: String,
    enum: RegistrationStatus,
    default: RegistrationStatus.PENDING,
    required: true,
  })
  status: RegistrationStatus;

  @Prop({
    type: String,
    enum: RegistrationPaymentStatus,
    default: RegistrationPaymentStatus.UNPAID,
  })
  paymentStatus: RegistrationPaymentStatus;

  @Prop({ type: Number, default: null, min: 0 })
  price?: number | null;

  @Prop({ type: Boolean, default: true })
  membershipVerified: boolean;

  @Prop({ type: Number, default: null, min: 0 })
  amountPaid?: number | null;

  @Prop({ type: Date, default: null })
  confirmedAt?: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;

  @Prop({ type: String, trim: true, default: null })
  cancelReason?: string | null;

  @Prop({ type: String, trim: true, default: null })
  note?: string | null;

  @Prop({ type: RegistrantSchema, required: true })
  registrant: Registrant;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const RegistrationSchema = SchemaFactory.createForClass(Registration);

RegistrationSchema.index(
  { userId: 1, courseId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      userId: { $type: 'objectId' },
      status: { $ne: RegistrationStatus.CANCELLED },
    },
  },
);

RegistrationSchema.index({ 'registrant.email': 1, courseId: 1 });
RegistrationSchema.index({ userId: 1 });
RegistrationSchema.index({ memberId: 1 });
RegistrationSchema.index({ courseId: 1 });
RegistrationSchema.index({ status: 1 });
RegistrationSchema.index({ membershipVerified: 1 });
RegistrationSchema.index({ createdAt: -1 });
