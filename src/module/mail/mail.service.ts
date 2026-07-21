import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPortVal = this.configService.get<any>('SMTP_PORT');
    const smtpPort = smtpPortVal ? parseInt(smtpPortVal, 10) : 587;
    const secureVal = this.configService.get<any>('SMTP_SECURE');
    const secure = secureVal === 'true' || secureVal === true;
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  private getMailAttachments(includeQr = false): nodemailer.SendMailOptions['attachments'] {
    const logoPath = fs.existsSync(path.join(process.cwd(), 'src/assets/mail/logoHtcaa.png'))
      ? path.join(process.cwd(), 'src/assets/mail/logoHtcaa.png')
      : path.join(__dirname, '../../assets/mail/logoHtcaa.png');

    const attachments: nodemailer.SendMailOptions['attachments'] = [
      {
        filename: 'logoHtcaa.png',
        path: logoPath,
        cid: 'logoHtcaa',
      },
    ];

    if (includeQr) {
      const qrPath = fs.existsSync(path.join(process.cwd(), 'src/assets/mail/qrHtcaa.png'))
        ? path.join(process.cwd(), 'src/assets/mail/qrHtcaa.png')
        : path.join(__dirname, '../../assets/mail/qrHtcaa.png');

      attachments.push({
        filename: 'qrHtcaa.png',
        path: qrPath,
        cid: 'qrHtcaa',
      });
    }

    return attachments;
  }

  private getFrontendUrl(): string {
    let url =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    return url;
  }

  private getBackendUrl(): string {
    let url =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    return url;
  }

  async sendResetPasswordEmail(
    email: string,
    resetLink: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'HTCAA';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'HTCAA <no-reply@minvoicehcm.vn>';

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `[${appName}] Yêu cầu đặt lại mật khẩu tài khoản`,
        html: this.getResetPasswordTemplate(appName, resetLink),
        attachments: this.getMailAttachments(false),
        text: `
Đặt lại mật khẩu tài khoản ${appName} của bạn

Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
Liên kết này sẽ hết hạn trong 10 phút.

Liên kết đặt lại mật khẩu:
${resetLink}

Nếu bạn không thực hiện yêu cầu này, bạn có thể an tâm bỏ qua email này.
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
    const appName = this.configService.get<string>('APP_NAME') ?? 'HTCAA';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'HTCAA <no-reply@minvoicehcm.vn>';

    const backendUrl = this.getBackendUrl();
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
        subject: `[${appName}] Xác nhận đăng ký nhận bản tin`,
        html: this.getNewsletterConfirmationTemplate(appName, confirmationLink),
        attachments: this.getMailAttachments(false),
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
      throw new Error(
        `Failed to send newsletter confirmation email: ${error.message}`,
      );
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

    const appName = this.configService.get<string>('APP_NAME') ?? 'HTCAA';

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'HTCAA <no-reply@minvoicehcm.vn>';

    const frontendUrl = this.getFrontendUrl();
    const backendUrl = this.getBackendUrl();
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
            attachments: this.getMailAttachments(false),
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
          const reason = result.status === 'rejected' ? result.reason : '';
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
              <td style="background-color: #0054A6; padding: 28px 24px; text-align: center;">
                <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  <img src="cid:logoHtcaa" alt="${appName}" style="max-height: 60px; max-width: 220px; width: auto; height: auto; display: block; margin: 0 auto;" />
                </div>
                <p style="margin: 10px 0 0; color: #e0f2fe; font-size: 14px; font-weight: 500;">
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

                <table cellpadding="0" cellspacing="0" align="center" style="margin: 24px auto; border-collapse: separate;">
                  <tr>
                    <td align="center" bgcolor="#0054A6" style="border-radius: 10px; background-color: #0054A6;">
                      <a
                        href="${newsUrl}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 13px 24px;
                          font-family: Arial, sans-serif;
                          font-size: 15px;
                          font-weight: bold;
                          color: #ffffff !important;
                          text-decoration: none !important;
                          border-radius: 10px;
                          border: 1px solid #0054A6;
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
                    <a href="${unsubscribeLink}" target="_blank" style="color: #6b7280;">Hủy đăng ký</a> bất cứ lúc nào.
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
              <td style="background-color: #0054A6; padding: 28px 24px; text-align: center;">
                <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  <img src="cid:logoHtcaa" alt="${appName}" style="max-height: 60px; max-width: 220px; width: auto; height: auto; display: block; margin: 0 auto;" />
                </div>
                <p style="margin: 10px 0 0; color: #e0f2fe; font-size: 14px; font-weight: 500;">
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

                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto; border-collapse: separate;">
                  <tr>
                    <td align="center" bgcolor="#0054A6" style="border-radius: 10px; background-color: #0054A6;">
                      <a 
                        href="${confirmationLink}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 13px 24px;
                          font-family: Arial, sans-serif;
                          font-size: 15px;
                          font-weight: bold;
                          color: #ffffff !important;
                          text-decoration: none !important;
                          border-radius: 10px;
                          border: 1px solid #0054A6;
                        "
                      >
                        Xác nhận đăng ký
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Nếu nút trên không hoạt động, vui lòng sao chép và dán liên kết này vào trình duyệt của bạn:
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #daebff; border-radius: 10px; padding: 12px; word-break: break-all;">
                  <a href="${confirmationLink}" target="_blank" style="color: #0054a6; font-size: 13px; line-height: 1.6; text-decoration: underline; word-break: break-all;">${confirmationLink}</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Nếu bạn không đăng ký nhận bản tin này, bạn có thể an tâm bỏ qua email này.
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

  private getResetPasswordTemplate(appName: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Đặt lại mật khẩu</title>
  </head>

  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
            
            <tr>
              <td style="background-color: #0054A6; padding: 28px 24px; text-align: center;">
                <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  <img src="cid:logoHtcaa" alt="${appName}" style="max-height: 60px; max-width: 220px; width: auto; height: auto; display: block; margin: 0 auto;" />
                </div>
                <p style="margin: 10px 0 0; color: #e0f2fe; font-size: 14px; font-weight: 500;">
                  Yêu cầu đặt lại mật khẩu
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 36px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">
                  Đặt lại mật khẩu của bạn
                </h2>

                <p style="margin: 0 0 16px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
                  Nhấp vào nút bên dưới để tạo mật khẩu mới.
                </p>

                <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Liên kết này sẽ hết hạn sau <strong style="color: #111827;">10 phút</strong>.
                </p>

                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto; border-collapse: separate;">
                  <tr>
                    <td align="center" bgcolor="#0054A6" style="border-radius: 10px; background-color: #0054A6;">
                      <a 
                        href="${resetLink}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 13px 24px;
                          font-family: Arial, sans-serif;
                          font-size: 15px;
                          font-weight: bold;
                          color: #ffffff !important;
                          text-decoration: none !important;
                          border-radius: 10px;
                          border: 1px solid #0054A6;
                        "
                      >
                        Đặt lại mật khẩu
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Nếu nút bấm không hoạt động, vui lòng sao chép và dán liên kết này vào trình duyệt của bạn:
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #daebff; border-radius: 10px; padding: 12px; word-break: break-all;">
                  <a href="${resetLink}" target="_blank" style="color: #0054a6; font-size: 13px; line-height: 1.6; text-decoration: underline; word-break: break-all;">${resetLink}</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể an tâm bỏ qua email này.
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

  async sendSupplementRequestEmail(
    email: string,
    name: string,
    recordId: string,
    notes: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME') ?? 'HTCAA';
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'HTCAA <no-reply@minvoicehcm.vn>';
    const frontendUrl = this.getFrontendUrl();
    const supplementLink = `${frontendUrl}/bo-sung-ho-so?recordId=${recordId}`;

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
        attachments: this.getMailAttachments(false),
        text: `
Kính gửi ${name},

Cảm ơn bạn đã đăng ký tham gia hội viên ${appName}. 
Hồ sơ đăng ký của bạn cần được bổ sung/chỉnh sửa thông tin theo yêu cầu kiểm tra từ Ban Thư ký:

Nội dung yêu cầu bổ sung từ Quản trị viên:
${notes}

Vui lòng nhấp vào liên kết sau để cập nhật hồ sơ của bạn:
${supplementLink}

Trân trọng,
Ban thư ký ${appName}
      `,
      });
    } catch (error: any) {
      throw new Error(
        `Failed to send supplement request email: ${error.message}`,
      );
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
      'HTCAA <no-reply@minvoicehcm.vn>';

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
        attachments: this.getMailAttachments(true),
        text: `
Kính gửi ${name},

Chúc mừng bạn! Hồ sơ đăng ký hội viên ${appName} của bạn đã được Ban thư ký phê duyệt thành công.

Thông tin thanh toán:
Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)
STK: 7011326979
Tên TK: HOI TU VAN VA DAI LY THUE TP.HCM
Số tiền cần thanh toán: ${formattedFee}
Nội dung: ${applicationCode}

LIÊN HỆ HỖ TRỢ: 
Ms.Kiều:  0931 778 562

Trân trọng,
Ban thư ký ${appName}
      `,
      });
    } catch (error: any) {
      throw new Error(
        `Failed to send approval notification email: ${error.message}`,
      );
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
              <td style="background-color: #0054A6; padding: 28px 24px; text-align: center;">
                <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  <img src="cid:logoHtcaa" alt="${appName}" style="max-height: 60px; max-width: 220px; width: auto; height: auto; display: block; margin: 0 auto;" />
                </div>
                <p style="margin: 10px 0 0; color: #e0f2fe; font-size: 14px; font-weight: 500;">Thông báo bổ sung hồ sơ đăng ký</p>
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
                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto; border-collapse: separate;">
                  <tr>
                    <td align="center" bgcolor="#0054A6" style="border-radius: 10px; background-color: #0054A6;">
                      <a
                        href="${supplementLink}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 13px 24px;
                          font-family: Arial, sans-serif;
                          font-size: 15px;
                          font-weight: bold;
                          color: #ffffff !important;
                          text-decoration: none !important;
                          border-radius: 10px;
                          border: 1px solid #0054A6;
                        "
                      >
                        Cập nhật hồ sơ đăng ký
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Nếu nút trên không hoạt động, vui lòng sao chép và dán liên kết này vào trình duyệt của bạn:
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #daebff; border-radius: 10px; padding: 12px; word-break: break-all;">
                  <a href="${supplementLink}" target="_blank" style="color: #0054a6; font-size: 13px; line-height: 1.6; text-decoration: underline; word-break: break-all;">${supplementLink}</a>
                </div>
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
              <td style="background-color: #0054A6; padding: 28px 24px; text-align: center;">
                <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  <img src="cid:logoHtcaa" alt="${appName}" style="max-height: 60px; max-width: 220px; width: auto; height: auto; display: block; margin: 0 auto;" />
                </div>
                <p style="margin: 10px 0 0; color: #e0f2fe; font-size: 14px; font-weight: 500;">Thông báo chấp thuận hồ sơ & Hướng dẫn thanh toán</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px 32px 24px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">Kính gửi ${name},</h2>
                <p style="margin: 0 0 20px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                  Hồ sơ đăng ký hội viên của bạn đã được <strong>Ban thư ký ${appName}</strong> phê duyệt thành công. Vui lòng thực hiện chuyển khoản thanh toán phí hội viên theo thông tin bên dưới để hoàn tất đăng ký:
                </p>
                <div style="background-color: #daebff; border: 1px solid #93c5fd; padding: 20px; margin: 20px 0; border-radius: 12px; color: #1e3a8a;">
                  <h3 style="margin: 0 0 14px; color: #0054A6; font-size: 16px; border-bottom: 2px solid #93c5fd; padding-bottom: 8px;">THÔNG TIN THANH TOÁN</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #1e293b; line-height: 1.8;">
                    <tr>
                      <td width="35%" style="font-weight: bold; color: #0054A6;">Mã đơn đăng ký:</td>
                      <td style="font-family: monospace; font-size: 15px; font-weight: bold; color: #0054A6;">${applicationCode}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #0054A6;">Ngân hàng:</td>
                      <td style="font-weight: bold;">Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #0054A6;">STK:</td>
                      <td style="font-family: monospace; font-size: 16px; font-weight: bold; color: #0054A6;">7011326979</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #0054A6;">Tên TK:</td>
                      <td style="font-weight: bold;">HOI TU VAN VA DAI LY THUE TP.HCM</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #0054A6;">Số tiền cần nộp:</td>
                      <td style="font-size: 16px; font-weight: bold; color: #b91c1c;">${fee}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #0054A6; vertical-align: top;">Nội dung:</td>
                      <td>
                        <div style="font-weight: bold; color: #b91c1c; background-color: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-block;">
                          Họ và tên-số điện thoại-KDTDB2026
                        </div>
                        <div style="font-size: 13px; color: #475569; margin-top: 4px;">Ví dụ: <strong>NguyenVanA-09123456789-KDTDB2026</strong> (Mã đơn: <strong>${applicationCode}</strong>)</div>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 10px 0;">
                        <hr style="border: 0; border-top: 1px dashed #93c5fd; margin: 0;" />
                      </td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #0054A6;">LIÊN HỆ HỖ TRỢ:</td>
                      <td style="font-weight: bold; color: #1e293b;">Ms.Kiều: <a href="tel:0931778562" style="color: #0054A6; text-decoration: none;">0931 778 562</a></td>
                    </tr>
                  </table>
                  <div style="text-align: center; margin-top: 20px;">
                    <p style="margin: 0 0 10px; font-weight: bold; color: #0054A6; font-size: 14px;">Quét mã QR Vietcombank để chuyển khoản nhanh:</p>
                    <img src="cid:qrHtcaa" alt="Mã QR Thanh Toán Vietcombank" style="max-width: 240px; width: 100%; height: auto; border-radius: 10px; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);" />
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 32px;">
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Mọi thắc mắc vui lòng liên hệ Ban thư ký qua hotline <strong>0931 778 562 (Ms.Kiều)</strong>.
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
      'HTCAA <no-reply@minvoicehcm.vn>';
    const frontendUrl = this.getFrontendUrl();
    const activationLink = `${frontendUrl}/set-password?token=${activationToken}`;

    try {
      const defaultAttachments = this.getMailAttachments(false) || [];

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
        attachments: [
          ...defaultAttachments,
          {
            filename: `Chung_nhan_HTCAA_${memberCode}.pdf`,
            content: pdfBuffer,
          },
        ],
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
              <td style="background-color: #0054A6; padding: 28px 24px; text-align: center;">
                <div style="background-color: #ffffff; padding: 12px 24px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  <img src="cid:logoHtcaa" alt="${appName}" style="max-height: 60px; max-width: 220px; width: auto; height: auto; display: block; margin: 0 auto;" />
                </div>
                <p style="margin: 10px 0 0; color: #e0f2fe; font-size: 14px; font-weight: 500;">Chúc mừng Hội viên chính thức</p>
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
                <table cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto; border-collapse: separate;">
                  <tr>
                    <td align="center" bgcolor="#0054A6" style="border-radius: 10px; background-color: #0054A6;">
                      <a
                        href="${activationLink}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 13px 24px;
                          font-family: Arial, sans-serif;
                          font-size: 15px;
                          font-weight: bold;
                          color: #ffffff !important;
                          text-decoration: none !important;
                          border-radius: 10px;
                          border: 1px solid #0054A6;
                        "
                      >
                        Đặt mật khẩu & Kích hoạt
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Chúng tôi cũng đã đính kèm tệp PDF Giấy chứng nhận hội viên trực tiếp trong thư này để bạn lưu trữ và sử dụng.
                </p>
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                  Nếu nút trên không hoạt động, vui lòng sao chép và dán liên kết này vào trình duyệt của bạn:
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #daebff; border-radius: 10px; padding: 12px; word-break: break-all;">
                  <a href="${activationLink}" target="_blank" style="color: #0054a6; font-size: 13px; line-height: 1.6; text-decoration: underline; word-break: break-all;">${activationLink}</a>
                </div>
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
