import * as bcrypt from 'bcrypt';
import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoggerService } from '../../common/loggers/logger.service';
import { ERROR_RES, ERROR_INFO } from '../../constants/error.const';
import { User } from '../../schema/user.schema';
import { MessageResponse } from '../../types/message.res';
import { Role } from '../../utils/role/role';
import { comparePassword } from '../../utils/validate-password';
import { ChangePasswordDto } from './dto/change-password.req';
import { LoginReqType } from './dto/login.req';
import { LoginRes } from './dto/login.res';
import { RefreshTokenDto } from './dto/refresh-token.req';
import { RegisterAccountDto } from './dto/register.req';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModal: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  logger = new LoggerService(AuthService.name);

  async generateToken(userInfo: User) {
    const isExitingUser = await this.userModal.findOne({
      username: userInfo.username,
    });

    if (!isExitingUser) {
      throw new NotFoundException('username not found');
    }

    const payload = {
      id: isExitingUser?._id.toString(),
      username: userInfo.username,
      role: isExitingUser.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '12h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '24h',
    });

    const accessTokenExpiresIn = new Date();
    accessTokenExpiresIn.setMinutes(accessTokenExpiresIn.getMinutes() + 15);

    const refreshTokenExpiresIn = new Date();
    refreshTokenExpiresIn.setDate(refreshTokenExpiresIn.getDate() + 7);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: accessTokenExpiresIn.getTime(),
      refreshTokenExpiresIn: refreshTokenExpiresIn.getTime(),
    };
  }

  async register(
    registerAccountDTO: RegisterAccountDto,
  ): Promise<MessageResponse | null> {
    try {
      const { username, password } = registerAccountDTO;

      if (!username || !password) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid input',
        };
      }

      const isExistingAdmin = await this.userModal.countDocuments({
        role: Role.ADMIN,
      });

      this.logger.log(`Existing admin count: ${isExistingAdmin}`);

      if (isExistingAdmin > 0) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Admin account existed!',
        };
      }

      const duplicateUsername = await this.userModal.findOne({ username });

      if (duplicateUsername) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Username already exists',
        };
      }

      const newAdmin = new this.userModal({
        username,
        password,
        role: Role.ADMIN,
      });

      await newAdmin.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Register admin successfully',
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while registering account: ${error.message}`,
      };
    }
  }

  async login(loginDto: LoginReqType): Promise<LoginRes | null> {
    let response: LoginRes | null = null;
    try {
      const { username, password } = loginDto;
      if (!username || !password) {
        response = {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid input missing require: username or password',
          content: null,
        };
        return response;
      }

      const admin = await this.userModal
        .findOne({ username })
        .select('+password');

      if (!admin) {
        response = {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Account not exist!',
          content: null,
        };
        return response;
      }

      const isMatch = await comparePassword(password, admin.password);

      if (!isMatch) {
        response = {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Password is incorrect',
          content: null,
        };
        return response;
      }

      const token = await this.generateToken(admin);

      admin.refreshTokenHash = await this.hashRefreshToken(token.refreshToken);
      await admin.save();

      response = {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Login successfully',
        content: {
          accessToken: token.accessToken,
          expiresToken: Date.now() + 15 * 60 * 1000,
          refreshToken: token.refreshToken,
          expRefreshToken: Date.now() + 2 * 24 * 60 * 60 * 1000,
        },
      };
    } catch (error: any) {
      response = {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while login: ${error.message}`,
        content: null,
      };
    }
    return response;
  }

  async changePassword(
    changePasswordDto: ChangePasswordDto,
    userId: string,
  ): Promise<MessageResponse | null> {
    let response: MessageResponse | null = null;
    try {
      const { newPassword, oldPassword } = changePasswordDto;
      if (!newPassword || !oldPassword) {
        response = {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Old password and new password is required',
        };
        return response;
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
        response = {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found',
        };
        return response;
      }

      const isMatch = await comparePassword(oldPassword, user.password);

      if (!isMatch) {
        response = {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Old password is incorrect',
        };
        return response;
      }

      // user.password = newPassword;

      // await user.save();

      user.password = newPassword;
      (user as any).refreshTokenHash = null;
      (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1;

      await user.save();

      response = {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Change password successfully',
      };
    } catch (error: any) {
      response = {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while changing password: ${error.message}`,
      };
    }
    return response;
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<LoginRes | null> {
    try {
      const { refreshToken } = refreshTokenDto;

      if (!refreshToken || refreshToken.split('.').length !== 3) {
        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Refresh token is invalid format',
          content: null,
        };
      }

      let payload: any;

      try {
        payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        });
      } catch (error: any) {
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
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found or inactive',
          content: null,
        };
      }

      if (!(user as any).refreshTokenHash) {
        return {
          code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Refresh token has been revoked',
          content: null,
        };
      }

      if (((user as any).tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
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

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Token refreshed successfully',
        content: {
          accessToken: token.accessToken,
          expiresToken: token.accessTokenExpiresIn,
          refreshToken: token.refreshToken,
          expRefreshToken: token.refreshTokenExpiresIn,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INVALID_CREDENTIALS_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a reToken problem: ${error.message}`,
        content: null,
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
