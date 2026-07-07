import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { MembershipType } from '../utils/membership-type.enum';

export type MembershipRegistrationDocument =
  HydratedDocument<MembershipRegistration>;

@Schema({ timestamps: true, collection: 'membership_registrations' })
export class MembershipRegistration {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: MembershipType,
    required: true,
  })
  memberType: MembershipType;

  @Prop({ type: String, required: true, trim: true })
  address: string;

  @Prop({ type: String, required: true, trim: true })
  taxCode: string;

  @Prop({ type: String, required: true, trim: true })
  identityCode: string;

  @Prop({ type: String, required: true, trim: true })
  job: string;

  @Prop({ type: String, required: true, trim: true })
  position: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ type: String, required: true, trim: true })
  phoneNumber: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ type: Date, default: null })
  joinAt?: Date | null;

  @Prop({
    type: String,
    enum: ['pending', 'approved'],
    default: 'pending',
    required: true,
  })
  status: string;

  @Prop({ type: String, required: true, trim: true })
  avatar: string;

  @Prop({ type: Boolean, required: true })
  isProfessionalCertification: boolean;

  @Prop({ type: String, required: true, trim: true })
  professionalCertificationNumber: string;

  @Prop({ type: String, required: true, trim: true })
  companyName: string;

  // Optional fields
  @Prop({ type: String, default: null, trim: true })
  companyLicense?: string | null;

  @Prop({ type: String, default: null, trim: true })
  companyWebsiteUrl?: string | null;

  @Prop({ type: String, default: null, trim: true })
  companyPhoneNumber?: string | null;

  @Prop({ type: String, default: null, trim: true })
  companyJobType?: string | null;

  @Prop({ type: String, default: null, trim: true })
  companySlogan?: string | null;

  @Prop({ type: String, default: null, trim: true })
  introduceBy?: string | null;

  @Prop({ type: String, default: null, trim: true })
  logo?: string | null;

  // Soft-delete, phòng khi admin cần ẩn 1 hồ sơ khỏi danh sách mà không xóa hẳn
  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const MembershipRegistrationSchema = SchemaFactory.createForClass(
  MembershipRegistration,
);

MembershipRegistrationSchema.index({ isActive: 1 });
MembershipRegistrationSchema.index({ createdAt: -1 });
MembershipRegistrationSchema.index({ name: 'text', address: 'text' });
