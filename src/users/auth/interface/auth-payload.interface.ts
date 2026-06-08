import { Role } from '../../../utils/role/role';

export interface JwtPayload {
  id: string;
  username: string;
  role: Role;
  tokenVersion?: number;
}
