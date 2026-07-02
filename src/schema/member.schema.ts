import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user.schema';
import { MemberStatus } from '../utils/member-status.enum';
import { MemberType } from '../utils/member-type.enum';
import { PaymentMethod } from '../utils/payment-method.enum';

export type MemberDocument = HydratedDocument<Member>;

@Schema({ _id: false })
export class OrganizationInfo {
  @Prop({ type: String, trim: true, default: null })
  name?: string | null;

  @Prop({ type: String, trim: true, default: null })
  taxCode?: string | null;

  @Prop({ type: String, trim: true, default: null })
  employeeScale?: string | null;
}

export const OrganizationInfoSchema =
  SchemaFactory.createForClass(OrganizationInfo);

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
// Phục vụ tìm kiếm real-time theo MST trong tính năng Danh bạ & Tìm kiếm
MemberSchema.index({ 'organization.taxCode': 1 });
