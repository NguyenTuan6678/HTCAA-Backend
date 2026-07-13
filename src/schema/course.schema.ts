import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { User } from './user.schema';
import { CourseStatus } from '../utils/course-status.enum';
import { CourseType } from '../utils/course-type.enum';

export type CourseDocument = HydratedDocument<Course>;

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

  @Prop({ type: String, required: true, trim: true })
  slug: string;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: String, default: null, trim: true })
  location?: string | null;

  @Prop({ type: String, default: null })
  summary?: string | null;

  @Prop({ type: CourseFileSchema, default: null })
  image?: CourseFile | null;

  @Prop({ type: String, default: null, trim: true })
  learningType?: string | null;

  @Prop({ type: String, default: null, trim: true })
  duration?: string | null;

  @Prop({ type: Number, default: 0 })
  price: number;

  @Prop({ type: Number, required: true })
  memberPrice: number;

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

CourseSchema.index({ slug: 1 }, { unique: true });
CourseSchema.index({ createdBy: 1 });
CourseSchema.index({ status: 1 });
CourseSchema.index({ date: 1 });
CourseSchema.index({ isActive: 1 });
CourseSchema.index({ title: 'text', location: 'text', summary: 'text' });
