import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

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
