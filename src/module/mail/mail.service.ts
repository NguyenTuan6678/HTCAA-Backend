import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') ?? 587,
      secure: this.configService.get<boolean>('SMTP_SECURE') ?? false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendResetPasswordEmail(
    email: string,
    resetLink: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'Your App';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'Your App <no-reply@example.com>';

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `Reset your ${appName} password`,
        html: this.getResetPasswordTemplate(appName, resetLink),
        text: `
Reset your ${appName} password

You requested to reset your password.
This link will expire in 10 minutes.

Reset link:
${resetLink}

If you did not request this, you can ignore this email.
    `,
      });
    } catch (error: any) {
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }

  async sendNewsletterConfirmationEmail(
    email: string,
    confirmationLink: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'Your App';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'Your App <no-reply@example.com>';

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    const secret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'fallback_secret';
    const targetEmail = email.toLowerCase().trim();
    const token = crypto
      .createHmac('sha256', secret)
      .update(targetEmail)
      .digest('hex');
    const unsubscribeLink = `${backendUrl}/api/newsletter-subscriber/unsubscribe?email=${encodeURIComponent(targetEmail)}&token=${token}`;

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `Xác nhận đăng ký nhận bản tin của ${appName}`,
        html: this.getNewsletterConfirmationTemplate(appName, confirmationLink),
        text: `
Xác nhận đăng ký nhận bản tin của ${appName}

Cảm ơn bạn đã đăng ký nhận bản tin của chúng tôi! Vui lòng nhấn vào liên kết bên dưới để xác nhận đăng ký:

Xác nhận đăng ký:
${confirmationLink}

Nếu bạn không thực hiện yêu cầu này, bạn có thể an tâm bỏ qua email này.
    `,
        headers: {
          'List-Unsubscribe': `<${unsubscribeLink}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to send newsletter confirmation email: ${error.message}`);
    }
  }

  async sendNewsNotificationEmails(
    subscriberEmails: string[],
    news: {
      title: string;
      slug: string;
      summary?: string | null;
      thumbnailUrl?: string | null;
    },
  ): Promise<{ sent: number; failed: string[] }> {
    if (subscriberEmails.length === 0) {
      return { sent: 0, failed: [] };
    }

    const appName = this.configService.get<string>('APP_NAME') ?? 'Your App';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'Your App <no-reply@example.com>';

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    const secret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'fallback_secret';

    const newsUrl = `${frontendUrl}/tin-tuc/${news.slug}`;

    const CONCURRENCY = 10;
    const failed: string[] = [];
    let sent = 0;

    for (let i = 0; i < subscriberEmails.length; i += CONCURRENCY) {
      const chunk = subscriberEmails.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        chunk.map((rawEmail) => {
          const targetEmail = rawEmail.toLowerCase().trim();
          const token = crypto
            .createHmac('sha256', secret)
            .update(targetEmail)
            .digest('hex');
          const unsubscribeLink = `${backendUrl}/api/newsletter-subscriber/unsubscribe?email=${encodeURIComponent(targetEmail)}&token=${token}`;

          return this.transporter.sendMail({
            from,
            to: targetEmail,
            subject: `[${appName}] Tin tức mới: ${news.title}`,
            html: this.getNewsNotificationTemplate(
              appName,
              news,
              newsUrl,
              unsubscribeLink,
            ),
            text: `
${news.title}

${news.summary ?? ''}

Xem chi tiết:
${newsUrl}

Hủy nhận bản tin:
${unsubscribeLink}
        `,
            headers: {
              'List-Unsubscribe': `<${unsubscribeLink}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          });
        }),
      );

      results.forEach((result, idx) => {
        const email = chunk[idx];

        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed.push(email);
          const reason =
            result.status === 'rejected' ? result.reason : '';
          console.error(
            `Failed to send news notification to ${email}:`,
            reason,
          );
        }
      });
    }

    return { sent, failed };
  }

  private getNewsNotificationTemplate(
    appName: string,
    news: {
      title: string;
      summary?: string | null;
      thumbnailUrl?: string | null;
    },
    newsUrl: string,
    unsubscribeLink: string,
  ): string {
    const thumbnailBlock = news.thumbnailUrl
      ? `
                <tr>
                  <td style="padding: 0;">
                    <img
                      src="${news.thumbnailUrl}"
                      alt="${news.title}"
                      style="display: block; width: 100%; max-height: 260px; object-fit: cover;"
                    />
                  </td>
                </tr>
      `
      : '';

    const summaryBlock = news.summary
      ? `
                <p style="margin: 0 0 20px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  ${news.summary}
                </p>
      `
      : '';

    return `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tin tức mới</title>
  </head>

  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">

            <tr>
              <td style="background: linear-gradient(135deg, #111827, #374151); padding: 32px 28px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; line-height: 1.3;">
                  ${appName}
                </h1>
                <p style="margin: 8px 0 0; color: #d1d5db; font-size: 14px;">
                  Tin tức mới nhất
                </p>
              </td>
            </tr>

            ${thumbnailBlock}

            <tr>
              <td style="padding: 32px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px; line-height: 1.4;">
                  ${news.title}
                </h2>

                ${summaryBlock}

                <table cellpadding="0" cellspacing="0" align="center" style="margin: 24px auto;">
                  <tr>
                    <td>
                      <a
                        href="${newsUrl}"
                        style="
                          display: inline-block;
                          background-color: #111827;
                          color: #ffffff;
                          text-decoration: none;
                          padding: 13px 22px;
                          border-radius: 10px;
                          font-size: 15px;
                          font-weight: 700;
                        "
                      >
                        Đọc bài viết
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Bạn nhận được email này vì đã đăng ký nhận bản tin của ${appName}.
                    <a href="${unsubscribeLink}" style="color: #6b7280;">Hủy đăng ký</a> bất cứ lúc nào.
                  </p>

                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Đây là email tự động từ ${appName}. Vui lòng không trả lời email này.
                  </p>
                </div>
              </td>
            </tr>

          </table>

          <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} ${appName}. Tất cả các quyền được bảo lưu.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;
  }

  private getNewsletterConfirmationTemplate(
    appName: string,
    confirmationLink: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Xác nhận Đăng ký Bản tin</title>
  </head>

  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #111827, #374151); padding: 32px 28px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; line-height: 1.3;">
                  ${appName}
                </h1>
                <p style="margin: 8px 0 0; color: #d1d5db; font-size: 14px;">
                  Đăng ký nhận bản tin
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 36px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">
                  Xác nhận đăng ký của bạn
                </h2>

                <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Cảm ơn bạn đã đăng ký nhận bản tin của chúng tôi!
                  Vui lòng xác nhận đăng ký của bạn bằng cách nhấp vào nút bên dưới.
                </p>

                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto;">
                  <tr>
                    <td>
                      <a 
                        href="${confirmationLink}"
                        style="
                          display: inline-block;
                          background-color: #111827;
                          color: #ffffff;
                          text-decoration: none;
                          padding: 13px 22px;
                          border-radius: 10px;
                          font-size: 15px;
                          font-weight: 700;
                        "
                      >
                        Xác nhận đăng ký
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Nếu nút trên không hoạt động, vui lòng sao chép và dán liên kết này vào trình duyệt của bạn:
                </p>

                <p style="margin: 0; word-break: break-all; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; color: #374151; font-size: 13px; line-height: 1.6;">
                  ${confirmationLink}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Nếu bạn không đăng ký nhận bản tin này, bạn có thể an tâm bỏ qua email này.
                  </p>

                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Đây là email tự động từ ${appName}. Vui lòng không trả lời email này.
                  </p>
                </div>
              </td>
            </tr>

          </table>

          <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} ${appName}. Tất cả các quyền được bảo lưu.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;
  }

  private getResetPasswordTemplate(appName: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Password</title>
  </head>

  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            
            <tr>
              <td style="background: linear-gradient(135deg, #111827, #374151); padding: 32px 28px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; line-height: 1.3;">
                  ${appName}
                </h1>
                <p style="margin: 8px 0 0; color: #d1d5db; font-size: 14px;">
                  Password reset request
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 36px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">
                  Reset your password
                </h2>

                <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  We received a request to reset the password for your account.
                  Click the button below to create a new password.
                </p>

                <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  This link will expire in <strong style="color: #111827;">10 minutes</strong>.
                </p>

                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto;">
                  <tr>
                    <td>
                      <a 
                        href="${resetLink}"
                        style="
                          display: inline-block;
                          background-color: #111827;
                          color: #ffffff;
                          text-decoration: none;
                          padding: 13px 22px;
                          border-radius: 10px;
                          font-size: 15px;
                          font-weight: 700;
                        "
                      >
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  If the button does not work, copy and paste this link into your browser:
                </p>

                <p style="margin: 0; word-break: break-all; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; color: #374151; font-size: 13px; line-height: 1.6;">
                  ${resetLink}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    If you did not request a password reset, you can safely ignore this email.
                  </p>

                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    This is an automated email from ${appName}. Please do not reply.
                  </p>
                </div>
              </td>
            </tr>

          </table>

          <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} ${appName}. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
  }

  async sendSupplementRequestEmail(
    email: string,
    name: string,
    token: string,
    notes: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'HTCAA';
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'HTCAA <no-reply@example.com>';
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const supplementLink = `${frontendUrl}/bo-sung-ho-so?token=${token}`;

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `[${appName}] Yêu cầu bổ sung hồ sơ đăng ký hội viên`,
        html: this.getSupplementRequestTemplate(
          appName,
          name,
          supplementLink,
          notes,
        ),
        text: `
Kính gửi ${name},

Cảm ơn bạn đã đăng ký tham gia hội viên ${appName}. 
Hồ sơ đăng ký của bạn hiện chưa đạt yêu cầu tự động và cần bổ sung/chỉnh sửa các thông tin sau:

Lý do/Nội dung cần bổ sung:
${notes}

Vui lòng nhấp vào liên kết sau để cập nhật hồ sơ:
${supplementLink}

Trân trọng,
Ban thư ký ${appName}
      `,
      });
    } catch (error: any) {
      throw new Error(`Failed to send supplement request email: ${error.message}`);
    }
  }

  async sendApprovalNotificationEmail(
    email: string,
    name: string,
    applicationCode: string,
    fee: number,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'HTCAA';
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'HTCAA <no-reply@example.com>';

    const formattedFee = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(fee);

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `[${appName}] Thông báo chấp thuận hồ sơ hội viên & Hướng dẫn thanh toán`,
        html: this.getApprovalNotificationTemplate(
          appName,
          name,
          applicationCode,
          formattedFee,
        ),
        text: `
Kính gửi ${name},

Chúc mừng bạn! Hồ sơ đăng ký hội viên ${appName} của bạn đã được Ban thư ký phê duyệt thành công.

Thông tin thanh toán hội phí:
- Mã đơn đối chiếu: ${applicationCode} (Bắt buộc ghi vào nội dung chuyển khoản)
- Số tiền cần thanh toán: ${formattedFee}
- Tài khoản ngân hàng HTCAA:
  + Ngân hàng: BIDV - Chi nhánh Hà Nội
  + Số tài khoản: 12410001234567
  + Chủ tài khoản: HOI TIN HOC HTCAA
  + Nội dung chuyển khoản: Chuyen khoan hoi phi ${applicationCode}

Vui lòng hoàn thành chuyển khoản thanh toán hội phí để kích hoạt tài khoản hội viên chính thức.

Trân trọng,
Ban thư ký ${appName}
      `,
      });
    } catch (error: any) {
      throw new Error(`Failed to send approval notification email: ${error.message}`);
    }
  }

  private getSupplementRequestTemplate(
    appName: string,
    name: string,
    supplementLink: string,
    notes: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Yêu cầu bổ sung hồ sơ hội viên</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background: linear-gradient(135deg, #b91c1c, #991b1b); padding: 32px 28px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; line-height: 1.3;">${appName}</h1>
                <p style="margin: 8px 0 0; color: #fca5a5; font-size: 14px;">Thông báo bổ sung hồ sơ đăng ký</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Kính gửi ${name},</h2>
                <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Cảm ơn bạn đã đăng ký tham gia hội viên của <strong>${appName}</strong>. Qua kiểm tra tự động, hồ sơ của bạn hiện tại cần bổ sung hoặc điều chỉnh thông tin để tiếp tục quy trình xét duyệt.
                </p>
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                  <strong style="color: #991b1b; display: block; margin-bottom: 8px; font-size: 15px;">Nội dung cần bổ sung / chỉnh sửa:</strong>
                  <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.6; white-space: pre-line;">${notes}</p>
                </div>
                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto;">
                  <tr>
                    <td>
                      <a href="${supplementLink}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 13px 24px; border-radius: 10px; font-size: 15px; font-weight: 700;">Cập nhật hồ sơ đăng ký</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Nếu nút trên không hoạt động, vui lòng sao chép và dán liên kết này vào trình duyệt của bạn:
                </p>
                <p style="margin: 0; word-break: break-all; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; color: #374151; font-size: 13px; line-height: 1.6;">
                  ${supplementLink}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email hoặc liên hệ với Ban thư ký để được hỗ trợ.
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Đây là email tự động từ ${appName}. Vui lòng không trả lời trực tiếp email này.
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} ${appName}. Tất cả các quyền được bảo lưu.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;
  }

  private getApprovalNotificationTemplate(
    appName: string,
    name: string,
    applicationCode: string,
    fee: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chấp thuận đơn đăng ký hội viên</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background: linear-gradient(135deg, #047857, #065f46); padding: 32px 28px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; line-height: 1.3;">${appName}</h1>
                <p style="margin: 8px 0 0; color: #a7f3d0; font-size: 14px;">Chúc mừng bạn đã được chấp thuận hội viên</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Kính gửi ${name},</h2>
                <p style="margin: 0 0 20px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Hồ sơ đăng ký hội viên của bạn đã được <strong>Ban thư ký ${appName}</strong> phê duyệt thành công. Vui lòng thực hiện chuyển khoản thanh toán phí hội viên theo hướng dẫn chi tiết dưới đây để kích hoạt tài khoản chính thức:
                </p>
                <div style="background-color: #f0fdf4; border: 1px solid #d1fae5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <h3 style="margin: 0 0 14px; color: #065f46; font-size: 16px; border-bottom: 1px solid #a7f3d0; padding-bottom: 8px;">Thông Tin Thanh Toán</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #374151; line-height: 1.8;">
                    <tr>
                      <td width="40%" style="font-weight: bold; color: #065f46;">Số tiền cần nộp:</td>
                      <td style="font-size: 16px; font-weight: bold; color: #b91c1c;">${fee}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #065f46;">Mã đơn đối chiếu:</td>
                      <td style="font-family: monospace; font-size: 15px; font-weight: bold; background-color: #e6f4ea; padding: 2px 6px; border-radius: 4px; display: inline-block;">${applicationCode}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 8px 0;"><hr style="border: 0; border-top: 1px dashed #a7f3d0; margin: 4px 0;" /></td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #065f46;">Tên ngân hàng:</td>
                      <td>BIDV - Chi nhánh Hà Nội</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #065f46;">Số tài khoản:</td>
                      <td style="font-weight: bold;">12410001234567</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #065f46;">Chủ tài khoản:</td>
                      <td>HOI TIN HOC HTCAA</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #065f46; vertical-align: top;">Nội dung chuyển khoản:</td>
                      <td style="font-weight: bold; color: #b91c1c; background-color: #fef2f2; padding: 4px 8px; border-radius: 4px;">Chuyen khoan hoi phi ${applicationCode}</td>
                    </tr>
                  </table>
                </div>
                <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-top: 20px;">
                  <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
                    <strong>Lưu ý quan trọng:</strong> Vui lòng ghi chính xác nội dung chuyển khoản là <strong style="color: #b91c1c;">Chuyen khoan hoi phi ${applicationCode}</strong> để hệ thống tự động nhận diện và kích hoạt thẻ hội viên của bạn nhanh chóng.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Mọi thắc mắc vui lòng liên hệ Ban thư ký qua email hỗ trợ của ${appName}.
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Đây là email tự động từ ${appName}. Vui lòng không trả lời trực tiếp email này.
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} ${appName}. Tất cả các quyền được bảo lưu.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;
  }

  async sendCertificateEmail(
    email: string,
    name: string,
    memberCode: string,
    activationToken: string,
    pdfBuffer: Buffer,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'HTCAA';
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'HTCAA <no-reply@example.com>';
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const activationLink = `${frontendUrl}/dat-mat-khau?token=${activationToken}`;

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `[${appName}] Chúc mừng bạn đã trở thành Hội viên chính thức - Mã hội viên: ${memberCode}`,
        html: this.getCertificateTemplate(
          appName,
          name,
          memberCode,
          activationLink,
        ),
        text: `
Kính gửi ${name},

Chúc mừng bạn đã hoàn thành việc đóng phí hội viên và trở thành Hội viên chính thức của ${appName}.
Mã hội viên của bạn là: ${memberCode}

Vui lòng nhấp vào liên kết sau để đặt mật khẩu kích hoạt tài khoản của bạn trên cổng thông tin hội viên:
${activationLink}

Tên đăng nhập (username) của bạn chính là địa chỉ email này.
Chúng tôi cũng đã đính kèm Giấy chứng nhận hội viên chính thức dạng PDF trong email này để bạn tải về.

Trân trọng,
Ban thư ký ${appName}
      `,
        attachments: [
          {
            filename: `Chung_nhan_HTCAA_${memberCode}.pdf`,
            content: pdfBuffer,
          },
        ],
      });
    } catch (error: any) {
      throw new Error(`Failed to send certificate email: ${error.message}`);
    }
  }

  private getCertificateTemplate(
    appName: string,
    name: string,
    memberCode: string,
    activationLink: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chúc mừng hội viên mới</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background: linear-gradient(135deg, #1e3a8a, #1d4ed8); padding: 32px 28px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; line-height: 1.3;">${appName}</h1>
                <p style="margin: 8px 0 0; color: #93c5fd; font-size: 14px;">Chúc mừng Hội viên chính thức</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Kính gửi ${name},</h2>
                <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Chúc mừng bạn đã hoàn tất nghĩa vụ hội phí và trở thành hội viên chính thức của <strong>${appName}</strong>.
                </p>
                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; line-height: 1.8;">
                    <tr>
                      <td width="40%" style="font-weight: bold; color: #1e3a8a;">Mã hội viên:</td>
                      <td style="font-weight: bold; color: #1d4ed8; font-size: 16px;">${memberCode}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #1e3a8a;">Tên đăng nhập:</td>
                      <td>Địa chỉ email của bạn</td>
                    </tr>
                  </table>
                </div>
                <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Vui lòng nhấp vào liên kết bên dưới để đặt mật khẩu kích hoạt tài khoản của bạn và đăng nhập lần đầu vào Cổng hội viên HTCAA:
                </p>
                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto;">
                  <tr>
                    <td>
                      <a href="${activationLink}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 13px 24px; border-radius: 10px; font-size: 15px; font-weight: 700;">Đặt mật khẩu & Kích hoạt</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Chúng tôi cũng đã đính kèm tệp PDF Giấy chứng nhận hội viên trực tiếp trong thư này để bạn lưu trữ và sử dụng.
                </p>
                <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Nếu nút trên không hoạt động, vui lòng sao chép và dán liên kết này vào trình duyệt của bạn:
                </p>
                <p style="margin: 0; word-break: break-all; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; color: #374151; font-size: 13px; line-height: 1.6;">
                  ${activationLink}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Đây là email tự động từ ${appName}. Vui lòng không trả lời trực tiếp email này.
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} ${appName}. Tất cả các quyền được bảo lưu.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;
  }
}
