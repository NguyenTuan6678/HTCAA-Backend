import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import { JwtPayload } from '../interface/auth-payload.interface';
import { User, UserDocument } from '../../../schema/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name)
    private readonly userModal: Model<UserDocument>,
  ) {
    const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
    if (!jwtAccessSecret) {
      throw new Error(
        'JWT_ACCESS_SECRET is missing. Check your environment variables.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtAccessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userModal.findById(payload.id);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      id: user._id.toString(),
      username: user.email,
      role: user.role,
    };
  }
}
