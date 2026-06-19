import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TypeCategoryDocument = HydratedDocument<TypeCategory>;

@Schema({
  timestamps: true,
  collection: 'category_types',
})
export class TypeCategory {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const TypeCategorySchema = SchemaFactory.createForClass(TypeCategory);

TypeCategorySchema.index({ name: 1 }, { unique: true });
TypeCategorySchema.index({ createdAt: -1 });
