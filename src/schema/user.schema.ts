import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { createUserMethods } from '../hook/user.hook';
import { createUserPreSaveHooks } from '../middleware/users.middleware';
import { Role } from '../utils/role.enum';

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
  name: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    type: String,
  })
  email: string;

  @Prop({ required: true, type: String, select: false })
  password: string;

  @Prop({ default: true, type: Boolean })
  isActive: boolean;

  @Prop({
    type: String,
    enum: Role,
    default: Role.MEMBER,
    required: true,
  })
  role: Role;

  @Prop({ type: String, default: 'member' })
  memberType: string;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash?: string | null;

  @Prop({ type: String, default: null, select: false })
  previousRefreshTokenHash?: string | null;

  @Prop({ type: Date, default: null, select: false })
  previousRefreshTokenExpiresAt?: Date | null;

  @Prop({ type: String, default: null, select: false })
  resetPasswordTokenHash?: string | null;

  @Prop({ type: Date, default: null, select: false })
  resetPasswordExpiresAt?: Date | null;

  @Prop({ type: Number, default: 0, select: false })
  tokenVersion: number;

  @Prop({ type: Number, default: 0, select: false })
  failedLoginAttempts: number;

  @Prop({ type: Date, default: null, select: false })
  loginLockedUntil?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ createdAt: -1 });

createUserPreSaveHooks(UserSchema);
createUserMethods(UserSchema);
