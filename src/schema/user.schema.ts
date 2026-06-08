import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { createUserMethods } from '../hook/user.hook';
import { createUserPreSaveHooks } from '../middleware/users.middleware';
import { Role } from '../utils/role/role';

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): any;
}

export type UserDocument = HydratedDocument<User> & IUserMethods;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Prop({ required: true, trim: true, type: String })
  username: string;

  @Prop({ required: true, type: String, select: false })
  password: string;

  @Prop({ default: true, type: Boolean })
  isActive: boolean;

  @Prop({ type: String, enum: Role, required: true })
  role: Role;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash?: string | null;

  @Prop({ type: Number, default: 0 })
  tokenVersion: number;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ username: 1 });
UserSchema.index({ createdAt: -1 });

createUserPreSaveHooks(UserSchema);

createUserMethods(UserSchema);
