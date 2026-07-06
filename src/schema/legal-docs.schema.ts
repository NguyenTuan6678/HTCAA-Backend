import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum LegalDocStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
}

@Schema({ _id: false })
export class LegalDocFile {
  @Prop({ required: true })
  objectName: string; // MinIO object key, e.g. "legal-docs/files/1700000000-123456-contract.pdf"

  @Prop({ required: true })
  originalName: string; // original filename, e.g. "contract.pdf"

  @Prop({ required: true })
  mimeType: string; // e.g. "application/pdf"

  @Prop({ required: true })
  size: number; // file size in bytes

  url?: string | null;
}

export const LegalDocFileSchema = SchemaFactory.createForClass(LegalDocFile);

@Schema({ timestamps: true })
export class LegalDoc extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'LegalDocsCategory', default: null })
  categoryId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  type: string;

  // Ngày văn bản được ban hành (VD: ngày ký nghị định/thông tư)
  @Prop({ type: Date, default: null })
  issuedAt?: Date | null;

  // Ngày văn bản có hiệu lực thi hành
  @Prop({ type: Date, default: null })
  effectiveAt?: Date | null;

  @Prop({
    type: String,
    enum: LegalDocStatus,
    default: LegalDocStatus.DRAFT,
  })
  status: LegalDocStatus;

  // Stores the uploaded file metadata (PDF, DOCX, etc.)
  @Prop({ type: LegalDocFileSchema, default: null })
  file: LegalDocFile | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const LegalDocSchema = SchemaFactory.createForClass(LegalDoc);

LegalDocSchema.index({ categoryId: 1 });
LegalDocSchema.index({ status: 1 });
LegalDocSchema.index({ issuedAt: -1 });
LegalDocSchema.index({ effectiveAt: -1 });
LegalDocSchema.index({ createdAt: -1 });
