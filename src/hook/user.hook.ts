import * as bcrypt from 'bcrypt';
import { Schema, Document } from 'mongoose';

export function createUserMethods(schema: Schema): void {
  const schemaAny = schema as any;

  schemaAny.methods.comparePassword = async function (
    this: Document,
    candidatePassword: string,
  ): Promise<boolean> {
    try {
      const hashedPassword = String(this.get('password'));
      return await bcrypt.compare(candidatePassword, hashedPassword);
    } catch {
      return false;
    }
  };

  schemaAny.methods.toJSON = function (this: Document) {
    const obj = this.toObject();
    delete obj.password;
    delete obj.__v;
    return obj;
  };
}
