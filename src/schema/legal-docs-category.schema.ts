import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LegalDocsCategoryDocument = HydratedDocument<LegalDocsCategory>;

@Schema({
  timestamps: true,
  collection: 'legal_docs_categories',
})
export class LegalDocsCategory {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, trim: true })
  slug: string;

  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const LegalDocsCategorySchema =
  SchemaFactory.createForClass(LegalDocsCategory);

LegalDocsCategorySchema.index({ slug: 1 }, { unique: true });
LegalDocsCategorySchema.index({ name: 1 });
LegalDocsCategorySchema.index({ createdAt: -1 });
