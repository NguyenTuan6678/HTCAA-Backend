import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from './user.schema';
import { CourseStatus } from '../utils/course-status.enum';
import { CourseType } from '../utils/course-type.enum';

export type CourseDocument = HydratedDocument<Course>;

// File metadata for image, giống NewsFile / MembershipFile / PartnerFile / SocialPostFile,
// để lưu đủ thông tin (objectName, bucket, mimetype, size...) thay vì chỉ 1 string.
@Schema({ _id: false })
export class CourseFile {
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

export const CourseFileSchema = SchemaFactory.createForClass(CourseFile);

@Schema({ timestamps: true, collection: 'courses' })
export class Course {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: String, default: null, trim: true })
  location?: string | null;

  @Prop({ type: CourseFileSchema, default: null })
  image?: CourseFile | null;

  @Prop({ type: String, default: null, trim: true })
  learningType?: string | null;

  // Thời lượng khóa học, dạng free-text (VD: "4 giờ", "2 ngày", "08:00 - 17:00")
  @Prop({ type: String, default: null, trim: true })
  duration?: string | null;

  // Học phí cho người CHƯA là hội viên, đơn vị VND. null/0 = miễn phí
  @Prop({ type: Number, default: 0 })
  price: number;

  // Học phí ưu đãi cho hội viên, đơn vị VND. Bắt buộc phải nhập khi tạo course
  // để tránh trường hợp quên set giá hội viên
  @Prop({ type: Number, required: true })
  memberPrice: number;

  // Tên giảng viên (free text), VD: "TS. Nguyễn Văn A" hoặc nhiều tên cách nhau bằng dấu phẩy
  @Prop({ type: String, default: null, trim: true })
  lecturer?: string | null;

  @Prop({ type: Number, default: 0 })
  taxHours: number;

  @Prop({ type: Number, default: 0 })
  accountingHours: number;

  @Prop({ type: Number, default: null })
  totalSeats?: number | null;

  @Prop({ type: Number, default: 0, min: 0 })
  registeredSeats: number;

  @Prop({
    type: String,
    enum: CourseStatus,
    default: CourseStatus.DRAFT,
    required: true,
  })
  status: CourseStatus;

  @Prop({
    type: Types.ObjectId,
    ref: 'CourseCategory',
    default: null,
    index: true,
  })
  categoryId: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: CourseType,
    default: CourseType.OFFLINE,
    required: true,
    index: true,
  })
  type: CourseType;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course);

CourseSchema.index({ createdBy: 1 });
CourseSchema.index({ status: 1 });
CourseSchema.index({ date: 1 });
CourseSchema.index({ isActive: 1 });
CourseSchema.index({ title: 'text', location: 'text' });
