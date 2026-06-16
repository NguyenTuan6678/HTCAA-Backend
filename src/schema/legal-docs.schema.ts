import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum LegalDocStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
}

export class LegalDocFile {
  @Prop({ required: true })
  objectName: string; // MinIO object key, e.g. "legal-docs/files/1700000000-123456-contract.pdf"

  @Prop({ required: true })
  originalName: string; // original filename, e.g. "contract.pdf"

  @Prop({ required: true })
  mimeType: string; // e.g. "application/pdf"

  @Prop({ required: true })
  size: number; // file size in bytes
}

@Schema({ timestamps: true })
export class LegalDoc extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  type: string;

  @Prop({
    type: String,
    enum: LegalDocStatus,
    default: LegalDocStatus.DRAFT,
  })
  status: LegalDocStatus;

  // Stores the uploaded file metadata (PDF, DOCX, etc.)
  @Prop({ type: LegalDocFile, default: null })
  file: LegalDocFile | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const LegalDocSchema = SchemaFactory.createForClass(LegalDoc);
