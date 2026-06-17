import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentFileDocument = HydratedDocument<DocumentFile>;

export enum DocumentStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
}

@Schema({ _id: false })
export class FileMeta {
  @Prop({ required: true }) objectName: string;
  @Prop({ required: true }) originalName: string;
  @Prop({ required: true }) mimeType: string;
  @Prop({ required: true }) size: number;
}

@Schema({ timestamps: true, collection: 'documents' })
export class DocumentFile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'NewsCategory', default: null })
  categoryId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: String, enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Prop({ type: FileMeta, default: null })
  file: FileMeta | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const DocumentFileSchema = SchemaFactory.createForClass(DocumentFile);

DocumentFileSchema.index({ categoryId: 1 });
DocumentFileSchema.index({ status: 1 });
DocumentFileSchema.index({ createdAt: -1 });
