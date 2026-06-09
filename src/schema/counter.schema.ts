import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

@Schema({
  timestamps: true,
  collection: 'counters',
})
export class Counter {
  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: Number, default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);

CounterSchema.index({ key: 1 }, { unique: true });
