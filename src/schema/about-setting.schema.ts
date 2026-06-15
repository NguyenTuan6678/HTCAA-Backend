import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AboutSettingDocument = HydratedDocument<AboutSetting>;

@Schema({ _id: false })
export class ExecutiveBoardMember {
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  position: string;

  @Prop()
  description?: string;

  @Prop({ type: Object, default: null })
  avatar?: any;

  @Prop({ default: 0 })
  order: number;
}

export const ExecutiveBoardMemberSchema =
  SchemaFactory.createForClass(ExecutiveBoardMember);

@Schema({
  timestamps: true,
  collection: 'about_settings',
})
export class AboutSetting {
  @Prop({
    type: {
      title: String,
      content: String,
    },
    default: {
      title: 'Giới thiệu',
      content: '',
    },
  })
  introduction: {
    title: string;
    content: string;
  };

  @Prop({
    type: [ExecutiveBoardMemberSchema],
    default: [],
  })
  executiveBoard: ExecutiveBoardMember[];
}

export const AboutSettingSchema = SchemaFactory.createForClass(AboutSetting);
