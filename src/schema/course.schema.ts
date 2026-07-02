import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from './user.schema';
import { CourseStatus } from '../utils/course-status.enum';

export type CourseDocument = HydratedDocument<Course>;

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

  @Prop({ type: String, default: null, trim: true })
  learningType?: string | null;

  // Thời lượng khóa học tính bằng phút (VD: 240 = 4 tiếng)
  @Prop({ type: Number, default: null })
  duration?: number | null;

  // Học phí, đơn vị VND. null/0 = miễn phí
  @Prop({ type: Number, default: 0 })
  price: number;

  // Tên giảng viên (free text), VD: "TS. Nguyễn Văn A" hoặc nhiều tên cách nhau bằng dấu phẩy
  @Prop({ type: String, default: null, trim: true })
  lecturer?: string | null;

  @Prop({ type: Number, default: 0 })
  cpeHours: number;

  @Prop({ type: Number, default: 0 })
  taxHours: number;

  @Prop({ type: Number, default: 0 })
  accountingHours: number;

  @Prop({ type: Number, default: null })
  totalSeats?: number | null;

  @Prop({ type: Number, default: 0 })
  registeredSeats: number;

  @Prop({
    type: String,
    enum: CourseStatus,
    default: CourseStatus.DRAFT,
    required: true,
  })
  status: CourseStatus;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course);

CourseSchema.index({ createdBy: 1 });
CourseSchema.index({ status: 1 });
CourseSchema.index({ date: 1 });
CourseSchema.index({ isActive: 1 });
CourseSchema.index({ title: 'text', location: 'text' });
