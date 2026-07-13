import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { MembershipType } from '../utils/membership-type.enum';

export type MembershipRegistrationDocument =
  HydratedDocument<MembershipRegistration>;

@Schema({ _id: false })
export class MembershipFile {
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

export const MembershipFileSchema =
  SchemaFactory.createForClass(MembershipFile);

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

  @Prop({ type: MembershipFileSchema, required: true })
  avatar: MembershipFile;

  @Prop({ type: Boolean, required: true })
  isProfessionalCertification: boolean;

  @Prop({ type: String, required: true, trim: true })
  professionalCertificationNumber: string;

  @Prop({ type: String, required: true, trim: true })
  companyName: string;

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

  @Prop({ type: MembershipFileSchema, default: null })
  banner?: MembershipFile | null;

  @Prop({ type: String, default: null, trim: true })
  starRating?: string | null;

  @Prop({ type: String, default: null, trim: true })
  tenure?: string | null;

  @Prop({ type: String, default: null, trim: true })
  tag?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const MembershipRegistrationSchema = SchemaFactory.createForClass(
  MembershipRegistration,
);

MembershipRegistrationSchema.index({ isActive: 1 });
MembershipRegistrationSchema.index({ createdAt: -1 });
MembershipRegistrationSchema.index({ name: 'text', address: 'text' });
