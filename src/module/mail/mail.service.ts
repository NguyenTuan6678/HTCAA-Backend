import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as crypto from 'crypto';

@Injectable()
export class MailService {
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is missing');
    }

    this.resend = new Resend(apiKey);
  }

  async sendResetPasswordEmail(
    email: string,
    resetLink: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'Your App';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'Your App <onboarding@resend.dev>';

    const { error } = await this.resend.emails.send({
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

    if (error) {
      throw new Error(error.message);
    }
  }

  async sendNewsletterConfirmationEmail(
    email: string,
    confirmationLink: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'Your App';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'Your App <onboarding@resend.dev>';

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

    const { error } = await this.resend.emails.send({
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

    if (error) {
      throw new Error(error.message);
    }
  }

  // ─── Gửi mail thông báo tin tức mới cho toàn bộ subscriber đã xác nhận ────
  // Không throw khi 1 email gửi lỗi — tránh 1 địa chỉ hỏng làm chặn cả batch.
  // Trả về { sent, failed } để caller (NewsService) tự log/theo dõi.
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
      'Your App <onboarding@resend.dev>';

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    const secret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'fallback_secret';

    const newsUrl = `${frontendUrl}/tin-tuc/${news.slug}`;

    // Giới hạn số email gửi song song mỗi đợt để tránh dồn quá nhiều request
    // cùng lúc lên Resend (không phải giới hạn cứng của Resend, chỉ là mức
    // an toàn hợp lý — có thể chỉnh lại tùy rate limit gói đang dùng).
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

          return this.resend.emails.send({
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

        if (result.status === 'fulfilled' && !result.value.error) {
          sent++;
        } else {
          failed.push(email);
          const reason =
            result.status === 'rejected' ? result.reason : result.value.error;
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
}
