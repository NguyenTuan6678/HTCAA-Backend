import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { MembershipType } from '../utils/membership-type.enum';

export type MembershipRegistrationDocument =
  HydratedDocument<MembershipRegistration>;

@Schema({ timestamps: true, collection: 'membership_registrations' })
export class MembershipRegistration {
  @Prop({ type: String, required: true, trim: true })
  memberName: string;

  @Prop({
    type: String,
    enum: MembershipType,
    required: true,
  })
  memberType: MembershipType;

  @Prop({ type: String, required: true, trim: true })
  address: string;

  @Prop({ type: String, default: null, trim: true })
  shortDescription?: string | null;

  @Prop({ type: String, default: null, trim: true })
  website?: string | null;

  @Prop({ type: String, default: null, trim: true })
  hotline?: string | null;

  @Prop({ type: String, default: null, trim: true, lowercase: true })
  email?: string | null;

  // Soft-delete, phòng khi admin cần ẩn 1 hồ sơ khỏi danh sách mà không xóa hẳn
  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const MembershipRegistrationSchema = SchemaFactory.createForClass(
  MembershipRegistration,
);

MembershipRegistrationSchema.index({ isActive: 1 });
MembershipRegistrationSchema.index({ createdAt: -1 });
MembershipRegistrationSchema.index({ memberName: 'text', address: 'text' });
