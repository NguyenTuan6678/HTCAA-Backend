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

// Snapshot thông tin người đăng ký tại thời điểm đăng ký, không tham chiếu
// qua User/Member profile để tránh việc hóa đơn/chứng nhận cũ bị đổi theo
// nếu sau này user cập nhật lại thông tin cá nhân.
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

  // Số chứng chỉ hành nghề
  @Prop({ type: String, required: true, trim: true })
  taxCodeActive: string;

  // Ngày cấp chứng chỉ hành nghề
  @Prop({ type: Date, required: true })
  taxCodeActiveDate: Date;

  // Kết quả CUỐI CÙNG sau khi được xác thực: BE tự set (member đã login) hoặc
  // admin xác nhận thủ công (guest). null = chưa xác thực (chỉ xảy ra với guest)
  @Prop({ type: Boolean, default: null })
  isMember?: boolean | null;

  // Chỉ có giá trị với guest: guest tự khai lúc đăng ký, chờ admin đối chiếu.
  // Với user đã login thì field này không dùng tới (isMember đã tự xác định).
  @Prop({ type: Boolean, default: null })
  claimedIsMember?: boolean | null;

  @Prop({ type: String, required: true, trim: true })
  companyName: string;

  // Mã số thuế công ty
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
  // null nếu đây là đăng ký của khách vãng lai (không đăng nhập)
  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  userId?: Types.ObjectId | null;

  // null nếu tại thời điểm đăng ký user chưa phải là hội viên (status ACTIVE)
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

  // Số tiền phải trả, BE tự tính = course.price hoặc course.memberPrice.
  // null với guest cho tới khi admin xác thực claim hội viên (verify-membership)
  @Prop({ type: Number, default: null })
  price?: number | null;

  // true: đã xác định isMember chắc chắn (flow user login luôn true ngay khi tạo).
  // false: guest tự khai, đang chờ admin đối chiếu qua endpoint verify-membership
  @Prop({ type: Boolean, default: true })
  membershipVerified: boolean;

  // Số tiền đã thực nhận, có thể khác price nếu thanh toán từng phần
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

  @Prop({ type: RegistrantSchema, required: true })
  registrant: Registrant;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const RegistrationSchema = SchemaFactory.createForClass(Registration);

// Một user (đã đăng nhập) không được có 2 đăng ký "còn hiệu lực" cho cùng 1
// khóa học, nhưng vẫn có thể đăng ký lại sau khi đã hủy. Index này CHỈ áp dụng
// khi userId tồn tại (là ObjectId thật) -> guest (userId = null) không bị áp
// ràng buộc unique này, vì nhiều bản ghi cùng userId=null sẽ bị Mongo coi là
// trùng nếu không loại trừ ra.
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
// Hỗ trợ check trùng đăng ký của guest ở tầng application (theo email + courseId)
RegistrationSchema.index({ 'registrant.email': 1, courseId: 1 });
RegistrationSchema.index({ userId: 1 });
RegistrationSchema.index({ memberId: 1 });
RegistrationSchema.index({ courseId: 1 });
RegistrationSchema.index({ status: 1 });
RegistrationSchema.index({ membershipVerified: 1 });
RegistrationSchema.index({ createdAt: -1 });
