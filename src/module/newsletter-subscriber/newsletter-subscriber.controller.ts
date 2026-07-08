import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { NewsletterSubscriberService } from './newsletter-subscriber.service';
import { SubscribeDto } from './dto/subscribe.req';
import { QuerySubscriberDto } from './dto/query-subscriber.req';
import { Roles } from '../../users/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Role } from '../../utils/role/role';

@ApiTags('Newsletter Subscribers')
@Controller('newsletter-subscriber')
export class NewsletterSubscriberController {
  constructor(
    private readonly subscriberService: NewsletterSubscriberService,
    private readonly configService: ConfigService,
  ) {}

  // ─── PUBLIC ENDPOINTS ──────────────────────────────────────────────────────

  @Post('subscribe')
  @ApiOperation({ summary: 'Public – subscribe email to the newsletter' })
  @ApiBody({ type: SubscribeDto })
  subscribe(@Body() dto: SubscribeDto) {
    return this.subscriberService.subscribe(dto);
  }

  @Post('resend-confirmation')
  @ApiOperation({ summary: 'Public – resend newsletter confirmation email' })
  @ApiBody({ type: SubscribeDto })
  resendConfirmation(@Body() dto: SubscribeDto) {
    return this.subscriberService.resendConfirmation(dto);
  }

  @Get('confirm')
  @ApiOperation({
    summary: 'Public – confirm newsletter subscription via email link',
  })
  async confirm(@Query('token') token: string, @Res() res: Response) {
    const result = await this.subscriberService.confirmSubscription(token);
    const isSuccess = result.code === 200;
    const title = isSuccess ? 'Xác nhận đăng ký nhận tin' : 'Xác nhận thất bại';
    const heading = isSuccess
      ? 'Đăng ký nhận tin tức thành công!'
      : 'Xác nhận thất bại';

    res.setHeader('Content-Type', 'text/html');
    return res.send(
      this.renderHtmlPage(title, heading, result.message, isSuccess),
    );
  }

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Public – unsubscribe from the newsletter' })
  async unsubscribe(
    @Query('email') email: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const result = await this.subscriberService.unsubscribe(email, token);
    const isSuccess = result.code === 200;
    const title = isSuccess ? 'Hủy đăng ký nhận tin' : 'Hủy đăng ký thất bại';
    const heading = isSuccess
      ? 'Hủy đăng ký nhận tin tức thành công!'
      : 'Hủy đăng ký thất bại';

    res.setHeader('Content-Type', 'text/html');
    return res.send(
      this.renderHtmlPage(title, heading, result.message, isSuccess),
    );
  }

  @Post('unsubscribe')
  @ApiOperation({
    summary:
      'Public – unsubscribe from the newsletter via POST (Gmail RFC 8058)',
  })
  async unsubscribePost(
    @Query('email') email: string,
    @Query('token') token: string,
  ) {
    return this.subscriberService.unsubscribe(email, token);
  }

  // ─── ADMIN ENDPOINTS ───────────────────────────────────────────────────────

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – list subscribers (paginated)' })
  findAll(@Query() query: QuerySubscriberDto) {
    return this.subscriberService.findAll(query);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – get subscriber details by ID' })
  @ApiParam({ name: 'id', description: 'Subscriber ID' })
  findOne(@Param('id') id: string) {
    return this.subscriberService.findOne(id);
  }

  @Patch('admin/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({
    summary: 'Admin/editor – toggle confirmation status manually',
  })
  @ApiParam({ name: 'id', description: 'Subscriber ID' })
  toggleConfirm(@Param('id') id: string) {
    return this.subscriberService.toggleConfirm(id);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.EDITOR)
  @ApiBearerAuth('authorization')
  @ApiOperation({ summary: 'Admin/editor – soft delete a subscriber' })
  @ApiParam({ name: 'id', description: 'Subscriber ID' })
  delete(@Param('id') id: string) {
    return this.subscriberService.delete(id);
  }

  private renderHtmlPage(
    title: string,
    heading: string,
    message: string,
    isSuccess: boolean,
  ): string {
    let frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'localhost:3000';
    if (
      !frontendUrl.startsWith('http://') &&
      !frontendUrl.startsWith('https://')
    ) {
      frontendUrl = `http://${frontendUrl}`;
    }
    const bgGradient = isSuccess
      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
      : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
    const icon = isSuccess
      ? '<svg style="width: 48px; height: 48px; color: #10B981;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
      : '<svg style="width: 48px; height: 48px; color: #EF4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #1f2937;
        }
        .card {
            background: #ffffff;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 420px;
            width: 90%;
        }
        .icon-container {
            width: 80px;
            height: 80px;
            background-color: ${isSuccess ? '#E6F4EA' : '#FCE8E6'};
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 24px;
        }
        h1 {
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 12px;
            color: #111827;
        }
        p {
            font-size: 15px;
            color: #4b5563;
            line-height: 1.6;
            margin: 0 0 24px;
        }
        .btn {
            display: inline-block;
            background: ${bgGradient};
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-container">
            ${icon}
        </div>
        <h1>${heading}</h1>
        <p>${message}</p>
        <a href="${frontendUrl}" class="btn">Quay lại Trang chủ</a>
    </div>
</body>
</html>
    `;
  }
}
