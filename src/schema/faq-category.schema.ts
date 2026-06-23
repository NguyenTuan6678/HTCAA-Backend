import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FaqCategoryDocument = HydratedDocument<FaqCategory>;

@Schema({
    timestamps: true,
    collection: 'faq_categories',
})
export class FaqCategory {
    @Prop({ type: String, required: true })
    title: string;

    @Prop({ type: String, required: true, trim: true })
    name: string;

    @Prop({ type: String, required: true, trim: true })
    slug: string;

    @Prop({ type: String, default: null, trim: true })
    description?: string | null;

    @Prop({ type: Boolean, default: true })
    isActive: boolean;
}

export const FaqCategorySchema =
    SchemaFactory.createForClass(FaqCategory);

FaqCategorySchema.index({ slug: 1 }, { unique: true });
FaqCategorySchema.index({ title: 1 }, { unique: true });
FaqCategorySchema.index({ name: 1 });
FaqCategorySchema.index({ createdAt: -1 });
