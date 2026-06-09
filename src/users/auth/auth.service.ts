import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
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
    @InjectModel(User.name) private userModal: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  logger = new LoggerService(AuthService.name);

  private readonly refreshCookieName = 'refreshToken';

  private readonly maxFailedLoginAttempts = 5;
  private readonly loginLockMinutes = 15;

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
      this.configService.get<string>('NODE_ENV') === 'production';

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
      this.getCookieOptions(15 * 60 * 1000),
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
    const existingUser = await this.userModal.findOne({
      email: userInfo.email,
    });

    if (!existingUser) {
      throw new NotFoundException('email not found');
    }

    const payload = {
      id: existingUser._id.toString(),
      email: existingUser.email,
      role: existingUser.role,
      memberType: existingUser.memberType ?? 'member',
      tokenVersion: existingUser.tokenVersion ?? 0,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '15m',
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: Date.now() + 15 * 60 * 1000,
      refreshTokenExpiresIn: Date.now() + 15 * 60 * 1000,
    };
  }

  async register(
    registerAccountDTO: RegisterAccountDto,
  ): Promise<MessageResponse | null> {
    try {
      const { name, email, password } = registerAccountDTO;

      if (!name || !email || !password) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid input',
        };
      }

      const existingAdmin = await this.userModal.countDocuments({
        role: Role.ADMIN,
      });

      this.logger.log(`Existing admin count: ${existingAdmin}`);

      if (existingAdmin > 0) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Admin account already exists',
        };
      }

      const duplicateEmail = await this.userModal.findOne({ email });

      if (duplicateEmail) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Email already exists',
        };
      }

      const newAdmin = new this.userModal({
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
      if (error.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Email already exists',
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while registering account: ${error.message}`,
      };
    }
  }

  async login(
    loginDto: LoginReqType,
    response: Response,
  ): Promise<LoginRes | null> {
    try {
      const { email, password } = loginDto;

      if (!email || !password) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid input missing require: email or password',
          content: null,
        };
      }

      const user = await this.userModal
        .findOne({ email })
        .select(
          '+password +refreshTokenHash +failedLoginAttempts +loginLockedUntil',
        );

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Account not exist!',
          content: null,
        };
      }

      if (!(user as any).isActive) {
        return {
          code: ERROR_RES.UNAUTHORIZED_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Account is inactive',
          content: null,
        };
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
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: `Too many failed login attempts. Please try again in ${this.getRemainingLockMinutes(
            user,
          )} minutes.`,
          content: null,
        };
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

          return {
            code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
            info: ERROR_INFO.FAIL,
            message: `Too many failed login attempts. Account is locked for ${this.loginLockMinutes} minutes.`,
            content: null,
          };
        }

        await user.save();

        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: `Password is incorrect. You have ${
            this.maxFailedLoginAttempts - failedLoginAttempts
          } attempt(s) remaining.`,
          content: null,
        };
      }

      const token = await this.generateToken(user);

      (user as any).failedLoginAttempts = 0;
      (user as any).loginLockedUntil = null;

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
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while login: ${error.message}`,
        content: null,
      };
    }
  }

  async logout(userId: string, response: Response): Promise<MessageResponse> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
        };
      }

      await this.userModal.findByIdAndUpdate(userId, {
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
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while logout: ${error.message}`,
      };
    }
  }

  async refreshTokenFromCookie(
    request: Request,
    response: Response,
  ): Promise<LoginRes | null> {
    try {
      const refreshToken = (request as any).cookies?.[this.refreshCookieName];

      if (!refreshToken || refreshToken.split('.').length !== 3) {
        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Refresh token is missing or invalid format',
          content: null,
        };
      }

      let payload: any;

      try {
        payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        });
      } catch (error: any) {
        this.clearRefreshTokenCookie(response);

        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: `Refresh token is invalid: ${error.message}`,
          content: null,
        };
      }

      const user = await this.userModal
        .findById(payload.id)
        .select('+refreshTokenHash')
        .exec();

      if (!user || !(user as any).isActive) {
        this.clearRefreshTokenCookie(response);

        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found or inactive',
          content: null,
        };
      }

      if (!(user as any).refreshTokenHash) {
        this.clearRefreshTokenCookie(response);

        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Refresh token has been revoked',
          content: null,
        };
      }

      if (((user as any).tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
        this.clearRefreshTokenCookie(response);

        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Refresh token version is no longer valid',
          content: null,
        };
      }

      const isRefreshTokenMatch = await this.compareRefreshToken(
        refreshToken,
        (user as any).refreshTokenHash,
      );

      if (!isRefreshTokenMatch) {
        (user as any).refreshTokenHash = null;
        (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1;

        await user.save();

        this.clearRefreshTokenCookie(response);

        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Refresh token reuse detected. Please login again.',
          content: null,
        };
      }

      const token = await this.generateToken(user);

      (user as any).refreshTokenHash = await this.hashRefreshToken(
        token.refreshToken,
      );

      await user.save();

      this.setRefreshTokenCookie(response, token.refreshToken);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Token refreshed successfully',
        content: {
          token: token.accessToken,
          user: this.toAuthUser(user),
        },
      };
    } catch (error: any) {
      this.clearRefreshTokenCookie(response);

      return {
        code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a refresh token problem: ${error.message}`,
        content: null,
      };
    }
  }

  async me(userId: string): Promise<any> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      const user = await this.userModal.findById(userId);

      if (!user || !(user as any).isActive) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found or inactive',
          content: null,
        };
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
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting current user: ${error.message}`,
        content: null,
      };
    }
  }

  async forgotPassword(email: string): Promise<MessageResponse> {
    try {
      if (!email) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Email is required',
        };
      }

      const decodedEmail = decodeURIComponent(email).toLowerCase().trim();

      const user = await this.userModal.findOne({ email: decodedEmail });

      // Không expose email có tồn tại hay không để tránh dò tài khoản
      if (!user) {
        return {
          code: ERROR_RES.SUCCESS.statusCode,
          info: ERROR_INFO.SUCCESS,
          message: 'If the email exists, reset password link has been sent',
        };
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = await bcrypt.hash(resetToken, 10);

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

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'If the email exists, reset password link has been sent',
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while forgot password: ${error.message}`,
      };
    }
  }

  async resetPassword(
    token: string,
    resetPasswordDto: ResetPasswordDto,
  ): Promise<MessageResponse> {
    try {
      const { newPassword } = resetPasswordDto;

      if (!token || !newPassword) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Token and new password are required',
        };
      }

      const users = await this.userModal
        .find({
          resetPasswordTokenHash: { $ne: null },
          resetPasswordExpiresAt: { $gt: new Date() },
        })
        .select('+resetPasswordTokenHash +resetPasswordExpiresAt +password');

      let matchedUser: any = null;

      for (const user of users) {
        const isMatch = await bcrypt.compare(
          token,
          (user as any).resetPasswordTokenHash,
        );

        if (isMatch) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Reset password token is invalid or expired',
        };
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
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while reset password: ${error.message}`,
      };
    }
  }

  async changePassword(
    changePasswordDto: ChangePasswordDto,
    userId: string,
  ): Promise<MessageResponse | null> {
    try {
      const { newPassword, oldPassword } = changePasswordDto;

      if (!newPassword || !oldPassword) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Old password and new password is required',
        };
      }

      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
        };
      }

      const user = await this.userModal.findById(userId).select('+password');

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found',
        };
      }

      const isMatch = await comparePassword(
        oldPassword,
        (user as any).password,
      );

      if (!isMatch) {
        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Old password is incorrect',
        };
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
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while changing password: ${error.message}`,
      };
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
