import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';
import { LoggerService } from '../../common/loggers/logger.service';
import { ERROR_RES, ERROR_INFO } from '../../constants/error.const';
import { User } from '../../schema/user.schema';
import { MessageResponse } from '../../types/message.res';
import { Role } from '../../utils/role/role';
import { comparePassword } from '../../utils/validate-password';
import { ChangePasswordDto } from './dto/change-password.req';
import { LoginReqType } from './dto/login.req';
import { LoginRes } from './dto/login.res';
import { RegisterAccountDto } from './dto/register.req';
import { ResetPasswordDto } from './dto/reset-password.req';
import { MailService } from '../../module/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly logger: LoggerService,
  ) {}

  private readonly refreshCookieName = 'refreshToken';

  private readonly maxFailedLoginAttempts = 5;
  private readonly loginLockMinutes = 15;
  private readonly refreshTokenGrave = process.env.REFRESH_TOKEN_GRACE_MS;

  private isLoginLocked(user: any): boolean {
    return (
      user.loginLockedUntil &&
      new Date(user.loginLockedUntil).getTime() > Date.now()
    );
  }

  private getRemainingLockMinutes(user: any): number {
    if (!user.loginLockedUntil) return 0;

    const remainingMs = new Date(user.loginLockedUntil).getTime() - Date.now();

    return Math.ceil(remainingMs / 1000 / 60);
  }

  private getCookieOptions(maxAge: number) {
    const isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge,
      path: '/api/auth',
    };
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    response.cookie(
      this.refreshCookieName,
      refreshToken,
      this.getCookieOptions(7 * 24 * 60 * 60 * 1000), // 7 days
    );
  }

  private clearRefreshTokenCookie(response: Response) {
    response.clearCookie(this.refreshCookieName, {
      path: '/api/auth',
    });
  }

  private toAuthUser(user: any) {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      memberType: user.memberType ?? 'member',
    };
  }

  async generateToken(userInfo: User) {
    const payload = {
      id: (userInfo as any)._id?.toString() || (userInfo as any).id,
      email: userInfo.email,
      role: userInfo.role,
      memberType: userInfo.memberType ?? 'member',
      tokenVersion: (userInfo as any).tokenVersion ?? 0,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: Date.now() + 15 * 60 * 1000,
      refreshTokenExpiresIn: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
  }

  async register(
    registerAccountDTO: RegisterAccountDto,
  ): Promise<MessageResponse | null> {
    try {
      const { name, email, password } = registerAccountDTO;

      const existingAdmin = await this.userModel.countDocuments({
        role: Role.ADMIN,
      });

      this.logger.log(
        `Existing admin count: ${existingAdmin}`,
        AuthService.name,
      );

      if (existingAdmin > 0) {
        throw new ConflictException('Admin account already exists');
      }

      const duplicateEmail = await this.userModel.findOne({ email });

      if (duplicateEmail) {
        throw new ConflictException('Email already exists');
      }

      const newAdmin = new this.userModel({
        name,
        email,
        password,
        role: Role.ADMIN,
        memberType: 'admin',
      });

      await newAdmin.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Register admin successfully',
      };
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (error.code === 11000) {
        throw new ConflictException('Email already exists');
      }

      throw new InternalServerErrorException(
        `There is a problem while registering account: ${error.message}`,
      );
    }
  }

  async login(
    loginDto: LoginReqType,
    response: Response,
  ): Promise<LoginRes | null> {
    try {
      const { email, password } = loginDto;

      const user = await this.userModel
        .findOne({ email })
        .select(
          '+password +refreshTokenHash +failedLoginAttempts +loginLockedUntil',
        );

      if (!user) {
        throw new NotFoundException('Account not exist!');
      }

      if (!(user as any).isActive) {
        throw new UnauthorizedException('Account is inactive');
      }

      const lockExpired =
        (user as any).loginLockedUntil &&
        new Date((user as any).loginLockedUntil).getTime() <= Date.now();

      if (lockExpired) {
        (user as any).failedLoginAttempts = 0;
        (user as any).loginLockedUntil = null;
        await user.save();
      }

      if (this.isLoginLocked(user)) {
        throw new ForbiddenException(
          `Too many failed login attempts. Please try again in ${this.getRemainingLockMinutes(
            user,
          )} minutes.`,
        );
      }

      const isMatch = await comparePassword(password, (user as any).password);

      if (!isMatch) {
        const failedLoginAttempts =
          ((user as any).failedLoginAttempts ?? 0) + 1;

        (user as any).failedLoginAttempts = failedLoginAttempts;

        if (failedLoginAttempts >= this.maxFailedLoginAttempts) {
          const lockedUntil = new Date();
          lockedUntil.setMinutes(
            lockedUntil.getMinutes() + this.loginLockMinutes,
          );

          (user as any).loginLockedUntil = lockedUntil;

          await user.save();

          throw new ForbiddenException(
            `Too many failed login attempts. Account is locked for ${this.loginLockMinutes} minutes.`,
          );
        }

        await user.save();

        throw new UnauthorizedException(
          `Password is incorrect. You have ${
            this.maxFailedLoginAttempts - failedLoginAttempts
          } attempt(s) remaining.`,
        );
      }

      const token = await this.generateToken(user);

      (user as any).failedLoginAttempts = 0;
      (user as any).loginLockedUntil = null;

      if ((user as any).refreshTokenHash) {
        (user as any).previousRefreshTokenHash = (user as any).refreshTokenHash;
        (user as any).previousRefreshTokenExpiresAt = new Date(
          Date.now() + Number(this.refreshTokenGrave),
        );
      }

      (user as any).refreshTokenHash = await this.hashRefreshToken(
        token.refreshToken,
      );

      await user.save();

      this.setRefreshTokenCookie(response, token.refreshToken);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Login successfully',
        content: {
          token: token.accessToken,
          user: this.toAuthUser(user),
        },
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while login: ${error.message}`,
      );
    }
  }

  async logout(userId: string, response: Response): Promise<MessageResponse> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user id');
      }

      await this.userModel.findByIdAndUpdate(userId, {
        refreshTokenHash: null,
        $inc: { tokenVersion: 1 },
      });

      this.clearRefreshTokenCookie(response);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Logout successfully',
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while logout: ${error.message}`,
      );
    }
  }

  async refreshToken(refreshToken: string | undefined, response: Response) {
    try {
      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token is required');
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (!payload?.id) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.userModel
        .findById(payload.id)
        .select(
          '+refreshTokenHash +previousRefreshTokenHash +previousRefreshTokenExpiresAt',
        );

      if (!user || !(user as any).isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      if ((user as any).tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      if (!(user as any).refreshTokenHash) {
        throw new UnauthorizedException('Refresh token not found');
      }

      const matchesCurrent = await this.compareRefreshToken(
        refreshToken,
        (user as any).refreshTokenHash,
      );

      let isGraceReuse = false;

      if (!matchesCurrent) {
        // Không khớp token hiện hành -> kiểm tra xem có phải là token NGAY
        // TRƯỚC lần rotate gần nhất, và còn trong khoảng grace hay không.
        const previousHash = (user as any).previousRefreshTokenHash;
        const previousExpiresAt = (user as any).previousRefreshTokenExpiresAt;

        const stillInGraceWindow =
          !!previousHash &&
          !!previousExpiresAt &&
          new Date(previousExpiresAt).getTime() > Date.now();

        if (stillInGraceWindow) {
          isGraceReuse = await this.compareRefreshToken(
            refreshToken,
            previousHash,
          );
        }

        if (!isGraceReuse) {
          // Token không khớp current, cũng không khớp previous-trong-grace
          // -> đây là dấu hiệu reuse-attack thật sự. Revoke toàn bộ session.
          (user as any).refreshTokenHash = null;
          (user as any).previousRefreshTokenHash = null;
          (user as any).previousRefreshTokenExpiresAt = null;
          (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1;
          await user.save();

          throw new UnauthorizedException('Invalid refresh token');
        }
      }

      // Hợp lệ (khớp current, hoặc khớp previous trong grace window) -> rotate.
      const { accessToken, refreshToken: newRefreshToken } =
        await this.generateToken(user);

      const newRefreshTokenHash = await this.hashRefreshToken(newRefreshToken);

      if (matchesCurrent) {
        // Rotate bình thường: hash hiện hành lùi thành "previous", mở grace
        // window mới cho nó — phòng trường hợp còn request song song khác
        // đang cầm đúng token này.
        (user as any).previousRefreshTokenHash = (user as any).refreshTokenHash;
        (user as any).previousRefreshTokenExpiresAt = new Date(
          Date.now() + Number(this.refreshTokenGrave),
        );
      }
      // Nếu là isGraceReuse: đây là request "sinh sau" của cùng 1 lần rotate,
      // KHÔNG động vào previousRefreshTokenHash hiện có — giữ nguyên grace
      // window ban đầu để các request song song khác (nếu còn) vẫn qua được.

      (user as any).refreshTokenHash = newRefreshTokenHash;
      await user.save();

      this.setRefreshTokenCookie(response, newRefreshToken);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Refresh token successfully',
        content: {
          token: accessToken,
          user: {
            id: (user as any)._id.toString(),
            name: (user as any).name,
            email: (user as any).email,
            role: (user as any).role,
            memberType: (user as any).memberType,
          },
        },
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token invalid or expired');
    }
  }

  async me(userId: string): Promise<any> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user id');
      }

      const user = await this.userModel.findById(userId);

      if (!user || !(user as any).isActive) {
        throw new NotFoundException('User not found or inactive');
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get current user successfully',
        content: {
          user: this.toAuthUser(user),
        },
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while getting current user: ${error.message}`,
      );
    }
  }

  async forgotPassword(email: string): Promise<MessageResponse> {
    try {
      if (!email) {
        throw new BadRequestException('Email is required');
      }

      const decodedEmail = decodeURIComponent(email).toLowerCase().trim();

      const user = await this.userModel.findOne({ email: decodedEmail });

      if (user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        // SHA-256 is fast O(1) query-able and highly secure for high-entropy tokens
        const resetTokenHash = crypto
          .createHash('sha256')
          .update(resetToken)
          .digest('hex');

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        (user as any).resetPasswordTokenHash = resetTokenHash;
        (user as any).resetPasswordExpiresAt = expiresAt;

        await user.save();

        const frontendUrl =
          this.configService.get<string>('FRONTEND_URL') ??
          'http://localhost:3000';

        const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

        await this.mailService.sendResetPasswordEmail(decodedEmail, resetLink);
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Reset password link has been sent successfully',
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while forgot password: ${error.message}`,
      );
    }
  }

  async resetPassword(
    token: string,
    resetPasswordDto: ResetPasswordDto,
  ): Promise<any> {
    try {
      const { newPassword } = resetPasswordDto;

      if (!token) {
        throw new BadRequestException('Token is required');
      }

      // SHA-256 lookup token
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const matchedUser = await this.userModel
        .findOne({
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: { $gt: new Date() },
        })
        .select('+resetPasswordTokenHash +resetPasswordExpiresAt +password');

      if (!matchedUser) {
        throw new UnauthorizedException(
          'Reset password token is invalid or expired',
        );
      }

      matchedUser.password = newPassword;
      matchedUser.refreshTokenHash = null;
      matchedUser.resetPasswordTokenHash = null;
      matchedUser.resetPasswordExpiresAt = null;
      matchedUser.tokenVersion = (matchedUser.tokenVersion ?? 0) + 1;

      await matchedUser.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Reset password successfully',
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while reset password: ${error.message}`,
      );
    }
  }

  async changePassword(
    changePasswordDto: ChangePasswordDto,
    userId: string,
  ): Promise<MessageResponse | null> {
    try {
      const { newPassword, oldPassword } = changePasswordDto;

      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user id');
      }

      const user = await this.userModel.findById(userId).select('+password');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const isMatch = await comparePassword(
        oldPassword,
        (user as any).password,
      );

      if (!isMatch) {
        throw new UnauthorizedException('Old password is incorrect');
      }

      (user as any).password = newPassword;
      (user as any).refreshTokenHash = null;
      (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1;

      await user.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Change password successfully',
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while changing password: ${error.message}`,
      );
    }
  }

  private async hashRefreshToken(refreshToken: string): Promise<string> {
    return await bcrypt.hash(refreshToken, 10);
  }

  private async compareRefreshToken(
    refreshToken: string,
    refreshTokenHash: string,
  ): Promise<boolean> {
    return await bcrypt.compare(refreshToken, refreshTokenHash);
  }
}
