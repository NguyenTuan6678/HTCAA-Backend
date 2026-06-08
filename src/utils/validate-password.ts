import * as bcrypt from 'bcryptjs';

export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  // console.log('🚀 ~ comparePassword ~ password:', password);
  // console.log('🚀 ~ comparePassword ~ hashedPassword:', hashedPassword);
  return bcrypt.compare(password, hashedPassword);
};
