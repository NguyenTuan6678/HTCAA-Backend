import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ERROR_RES } from '../../constants/error.const';
import { MessageResponse } from '../../types/message.res';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.req';
import { ForgotPasswordDto } from './dto/forgot-password.req';
import { LoginReqType } from './dto/login.req';
import { LoginRes } from './dto/login.res';
import { RegisterAccountDto } from './dto/register.req';
import { ResetPasswordDto } from './dto/reset-password.req';
import { JwtAuthGuard } from './guards/auth.guard';
import { Throttle } from '@nestjs/throttler';
import { RefreshTokenDto } from './dto/refresh-token.req';

type RequestWithCookies = Request & {
  cookies?: {
    refreshToken?: string;
    [key: string]: string | undefined;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'register account' })
  @ApiResponse({
    status: ERROR_RES.SUCCESS.statusCode,
    description: 'Register successfully',
    type: MessageResponse,
  })
  @ApiBody({ type: RegisterAccountDto, description: 'Register request' })
  register(@Body() registerAccountDto: RegisterAccountDto) {
    return this.authService.register(registerAccountDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'login account' })
  @ApiResponse({
    status: ERROR_RES.SUCCESS.statusCode,
    description: 'Login successfully',
    type: LoginRes,
  })
  @ApiBody({ type: LoginReqType, description: 'Login request' })
  login(
    @Body() loginDto: LoginReqType,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(loginDto, response);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'logout account' })
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userId = (request as any).user.id;
    return this.authService.logout(userId, response);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token by refresh token from body or cookie',
  })
  @ApiBody({
    type: RefreshTokenDto,
    required: false,
  })
  refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshTokenFromBody = refreshTokenDto?.refreshToken;
    const refreshTokenFromCookie = request.cookies?.refreshToken;

    const refreshToken = refreshTokenFromBody || refreshTokenFromCookie;

    return this.authService.refreshToken(refreshToken, response);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'forgot password' })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Param('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password/:token')
  @ApiOperation({ summary: 'reset password' })
  @ApiBody({ type: ResetPasswordDto })
  resetPassword(
    @Param('token') token: string,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(token, resetPasswordDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'get current user' })
  me(@Req() request: Request) {
    const userId = (request as any).user.id;
    return this.authService.me(userId);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'change password' })
  @ApiBearerAuth('authorization')
  @ApiResponse({
    status: ERROR_RES.SUCCESS.statusCode,
    description: 'Password changed successfully',
    type: MessageResponse,
  })
  @ApiBody({ type: ChangePasswordDto, description: 'Change password request' })
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    const userId = (request as any).user.id;
    return this.authService.changePassword(changePasswordDto, userId);
  }
}
