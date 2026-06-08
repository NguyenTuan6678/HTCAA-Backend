import * as bcrypt from 'bcrypt';
import { Schema } from 'mongoose';

export function createUserPreSaveHooks(schema: Schema): void {
  schema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    const password = String(this.get('password'));
    this.set('password', await bcrypt.hash(password, salt));
  });
}
