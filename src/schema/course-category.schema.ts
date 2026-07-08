import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CourseCategoryDocument = HydratedDocument<CourseCategory>;

@Schema({ timestamps: true, collection: 'course_categories' })
export class CourseCategory {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, trim: true })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CourseCategorySchema =
  SchemaFactory.createForClass(CourseCategory);

CourseCategorySchema.index({ slug: 1 }, { unique: true });
CourseCategorySchema.index({ name: 1 });
CourseCategorySchema.index({ createdAt: -1 });
