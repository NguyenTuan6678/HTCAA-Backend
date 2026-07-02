import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { Member } from './member.schema';
import { Course } from './course.schema';
import {
  RegistrationStatus,
  RegistrationPaymentStatus,
} from '../utils/registration-status.enum';

export type RegistrationDocument = HydratedDocument<Registration>;

@Schema({ timestamps: true, collection: 'registrations' })
export class Registration {
  @Prop({ type: Types.ObjectId, ref: Member.name, required: true })
  memberId: Types.ObjectId;

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

  @Prop({ type: Number, default: null })
  amountPaid?: number | null;

  @Prop({ type: Date, default: null })
  confirmedAt?: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;

  @Prop({ type: String, trim: true, default: null })
  cancelReason?: string | null;

  @Prop({ type: String, trim: true, default: null })
  note?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const RegistrationSchema = SchemaFactory.createForClass(Registration);

// Một member không được có 2 đăng ký "còn hiệu lực" cho cùng 1 khóa học,
// nhưng vẫn có thể đăng ký lại sau khi đã hủy (Cancelled không tính là trùng)
RegistrationSchema.index(
  { memberId: 1, courseId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $ne: RegistrationStatus.CANCELLED },
    },
  },
);
RegistrationSchema.index({ memberId: 1 });
RegistrationSchema.index({ courseId: 1 });
RegistrationSchema.index({ status: 1 });
RegistrationSchema.index({ createdAt: -1 });
