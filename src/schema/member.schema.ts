import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from './user.schema';
import { MemberStatus } from '../utils/member-status.enum';
import { MemberType } from '../utils/member-type.enum';
import { PaymentMethod } from '../utils/payment-method.enum';

export type MemberDocument = HydratedDocument<Member>;

@Schema({ _id: false })
export class MemberProfileFile {
  @Prop({ type: String, required: true })
  originalName: string;

  @Prop({ type: String, required: true })
  filename: string;

  @Prop({ type: String, required: true })
  path: string;

  @Prop({ type: String, required: true })
  mimetype: string;

  @Prop({ type: Number, required: true })
  size: number;
}

export const MemberProfileFileSchema =
  SchemaFactory.createForClass(MemberProfileFile);

@Schema({ _id: false })
export class OrganizationInfo {
  @Prop({ type: String, trim: true, default: null })
  name?: string | null;

  @Prop({ type: String, trim: true, default: null })
  taxCode?: string | null;

  @Prop({ type: String, trim: true, default: null })
  employeeScale?: string | null;

  @Prop({ type: String, trim: true, default: null })
  license?: string | null;

  @Prop({ type: String, trim: true, default: null })
  websiteUrl?: string | null;

  @Prop({ type: String, trim: true, default: null })
  phoneNumber?: string | null;

  @Prop({ type: String, trim: true, default: null })
  jobType?: string | null;

  @Prop({ type: String, trim: true, default: null })
  slogan?: string | null;

  @Prop({ type: MemberProfileFileSchema, default: null })
  banner?: MemberProfileFile | null;
}

export const OrganizationInfoSchema =
  SchemaFactory.createForClass(OrganizationInfo);

@Schema({
  timestamps: true,
  collection: 'members',
})
export class Member {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  memberCode: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ type: String, required: true, trim: true })
  phone: string;

  @Prop({ type: String, required: true, trim: true })
  certificateNumber: string;

  @Prop({ type: String, trim: true, default: null })
  workplace?: string | null;

  @Prop({ type: String, trim: true, default: null })
  district?: string | null;

  @Prop({ type: MemberProfileFileSchema, default: null })
  avatar?: MemberProfileFile | null;

  @Prop({ type: String, trim: true, default: null })
  address?: string | null;

  @Prop({ type: String, trim: true, default: null })
  identityCode?: string | null;

  @Prop({ type: String, trim: true, default: null })
  job?: string | null;

  @Prop({ type: String, trim: true, default: null })
  position?: string | null;

  @Prop({ type: Boolean, default: false })
  isProfessionalCertification: boolean;

  @Prop({ type: String, trim: true, default: null })
  introduceBy?: string | null;

  @Prop({
    type: String,
    enum: MemberType,
    required: true,
    default: MemberType.INDIVIDUAL,
  })
  memberType: MemberType;

  @Prop({ type: OrganizationInfoSchema, default: null })
  organization?: OrganizationInfo | null;

  @Prop({
    type: String,
    enum: PaymentMethod,
    required: true,
    default: PaymentMethod.BANK,
  })
  paymentMethod: PaymentMethod;

  @Prop({ type: MemberProfileFileSchema, default: null })
  profileFile?: MemberProfileFile | null;

  @Prop({ type: Number, default: 0 })
  cpeHours: number;

  @Prop({ type: MemberProfileFileSchema, default: null })
  certificateFile?: MemberProfileFile | null;

  @Prop({ type: MemberProfileFileSchema, default: null })
  certificateFilePng?: MemberProfileFile | null;

  @Prop({ type: MemberProfileFileSchema, default: null })
  certificateFileJpg?: MemberProfileFile | null;

  @Prop({
    type: String,
    enum: MemberStatus,
    default: MemberStatus.PENDING,
    required: true,
  })
  status: MemberStatus;

  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  @Prop({ type: Number, default: 0 })
  featuredOrder: number;

  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  approvedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  approvedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  rejectedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  rejectedAt?: Date | null;

  @Prop({ type: String, trim: true, default: null })
  rejectReason?: string | null;

  @Prop({ type: Date, default: null })
  expiredAt?: Date | null;

  @Prop({ type: String, trim: true, default: null })
  starRating?: string | null;

  @Prop({ type: String, trim: true, default: null })
  tenure?: string | null;

  @Prop({ type: String, trim: true, default: null })
  tag?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const MemberSchema = SchemaFactory.createForClass(Member);

MemberSchema.index({ userId: 1 }, { unique: true });
MemberSchema.index({ memberCode: 1 }, { unique: true });
MemberSchema.index({ email: 1 });
MemberSchema.index({ status: 1 });
MemberSchema.index({ district: 1 });
MemberSchema.index({ expiredAt: 1 });
MemberSchema.index({ createdAt: -1 });
MemberSchema.index({ 'organization.taxCode': 1 });
