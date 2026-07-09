import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const bearerToken = request.headers.authorization?.split(' ')[1];
    const cookieToken = request.cookies?.accessToken;

    const token = bearerToken || cookieToken;

    if (!token) {
      throw new UnauthorizedException(
        'No identity verification information available.',
      );
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      if (!payload) {
        throw new UnauthorizedException('Token not valid');
      }

      // Check token version directly via AuthService
      const isValidVersion = await this.authService.validateTokenVersion(
        payload.id,
        payload.tokenVersion,
      );

      if (!isValidVersion) {
        throw new UnauthorizedException('Token has been revoked');
      }

      request.user = payload;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'The account does not have the authority to perform this action or token expired.',
      );
    }
  }
}
