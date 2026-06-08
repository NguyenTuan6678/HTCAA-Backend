import { ApiProperty } from '@nestjs/swagger';
import { MessageResponse } from '../../../types/message.res';

export class LoginResType {
  @ApiProperty({ type: 'string' })
  accessToken: string;

  @ApiProperty({ type: 'number' })
  expiresToken: number;

  @ApiProperty({ type: 'string' })
  refreshToken: string;

  @ApiProperty({ type: 'number' })
  expRefreshToken: number;
}

export class LoginRes extends MessageResponse {
  @ApiProperty({ type: LoginResType, nullable: true })
  content: LoginResType | null;
}
