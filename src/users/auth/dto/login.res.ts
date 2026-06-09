import { ApiProperty } from '@nestjs/swagger';
import { MessageResponse } from '../../../types/message.res';
import { Role } from '../../../utils/role/role';

export class AuthUserResType {
  @ApiProperty({ type: 'string' })
  id: string;

  @ApiProperty({ type: 'string' })
  name: string;

  @ApiProperty({ type: 'string' })
  email: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ type: 'string' })
  memberType: string;
}

export class LoginResType {
  @ApiProperty({ type: 'string' })
  token: string;

  @ApiProperty({ type: AuthUserResType })
  user: AuthUserResType;
}

export class LoginRes extends MessageResponse {
  @ApiProperty({ type: LoginResType, nullable: true })
  content: LoginResType | null;
}
