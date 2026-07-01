import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SubscribeDto } from './dto/subscribe.req';
import { QuerySubscriberDto } from './dto/query-subscriber.req';
import { MailService } from '../mail/mail.service';
import { NewsletterSubscriber } from '../../schema/newsletter-subscriber.schema';
import { ERROR_RES, ERROR_INFO } from '../../constants/error.const';
import { escapeRegex } from '../../utils/escape-regex';

@Injectable()
export class NewsletterSubscriberService {
  constructor(
    @InjectModel(NewsletterSubscriber.name)
    private readonly subscriberModel: Model<NewsletterSubscriber>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  // =========================
  // PUBLIC METHODS
  // =========================

  async subscribe(dto: SubscribeDto) {
    try {
      const email = dto.email.toLowerCase().trim();
      let subscriber = await this.subscriberModel.findOne({ email, isActive: true });

      if (subscriber) {
        if (subscriber.confirmed) {
          return {
            code: ERROR_RES.SUCCESS.statusCode,
            info: ERROR_INFO.SUCCESS,
            message: 'Email này đã được đăng ký nhận bản tin từ trước.',
            content: { subscriber },
          };
        }

        // If subscribed but not confirmed, regenerate token and send confirmation mail again
        const token = crypto.randomBytes(32).toString('hex');
        subscriber.confirmationToken = token;
        await subscriber.save();

        await this.sendConfirmationMailSafely(email, token);

        return {
          code: ERROR_RES.SUCCESS.statusCode,
          info: ERROR_INFO.SUCCESS,
          message: 'Email xác nhận đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.',
          content: { subscriber },
        };
      }

      // Create new subscriber
      const token = crypto.randomBytes(32).toString('hex');
      subscriber = await this.subscriberModel.create({
        email,
        confirmed: false,
        confirmationToken: token,
        subscribedAt: new Date(),
        isActive: true,
      });

      await this.sendConfirmationMailSafely(email, token);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác nhận.',
        content: { subscriber },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Đã xảy ra sự cố khi đăng ký nhận tin: ${error.message}`,
        content: null,
      };
    }
  }

  async resendConfirmation(dto: SubscribeDto) {
    try {
      const email = dto.email.toLowerCase().trim();
      const subscriber = await this.subscriberModel.findOne({ email, isActive: true });

      if (!subscriber) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Không tìm thấy thông tin email đăng ký này.',
          content: null,
        };
      }

      if (subscriber.confirmed) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Email này đã được xác nhận và đang hoạt động.',
          content: null,
        };
      }

      const token = crypto.randomBytes(32).toString('hex');
      subscriber.confirmationToken = token;
      await subscriber.save();

      await this.sendConfirmationMailSafely(email, token);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Email xác nhận đã được gửi lại thành công. Vui lòng kiểm tra hộp thư.',
        content: { subscriber },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Đã xảy ra sự cố khi gửi lại email xác nhận: ${error.message}`,
        content: null,
      };
    }
  }

  async confirmSubscription(token: string) {
    try {
      if (!token) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Mã xác nhận (token) là bắt buộc.',
          content: null,
        };
      }

      const subscriber = await this.subscriberModel.findOne({
        confirmationToken: token,
        isActive: true,
      });

      if (!subscriber) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Mã xác nhận không hợp lệ hoặc đã hết hạn.',
          content: null,
        };
      }

      subscriber.confirmed = true;
      subscriber.confirmationToken = null; // Clear token after success
      await subscriber.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Đăng ký nhận tin tức thành công!',
        content: { subscriber },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Đã xảy ra sự cố khi xác nhận đăng ký: ${error.message}`,
        content: null,
      };
    }
  }

  async unsubscribe(email: string) {
    try {
      if (!email) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Email là bắt buộc.',
          content: null,
        };
      }

      const targetEmail = email.toLowerCase().trim();
      const subscriber = await this.subscriberModel.findOne({
        email: targetEmail,
        isActive: true,
      });

      if (!subscriber) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Không tìm thấy người đăng ký nhận tin này.',
          content: null,
        };
      }

      subscriber.confirmed = false;
      await subscriber.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Hủy đăng ký nhận bản tin thành công.',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Đã xảy ra sự cố khi hủy đăng ký nhận tin: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // ADMIN METHODS
  // =========================

  async findAll(query: QuerySubscriberDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.confirmed !== undefined) {
        filter.confirmed = query.confirmed;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        filter.email = new RegExp(escaped, 'i');
      }

      const [items, total] = await Promise.all([
        this.subscriberModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.subscriberModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get newsletter subscribers successfully',
        content: {
          items,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting subscribers: ${error.message}`,
        content: null,
      };
    }
  }

  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid subscriber ID',
          content: null,
        };
      }

      const subscriber = await this.subscriberModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!subscriber) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Subscriber not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get subscriber detail successfully',
        content: { subscriber },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting subscriber: ${error.message}`,
        content: null,
      };
    }
  }

  async toggleConfirm(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid subscriber ID',
          content: null,
        };
      }

      const subscriber = await this.subscriberModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!subscriber) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Subscriber not found',
          content: null,
        };
      }

      subscriber.confirmed = !subscriber.confirmed;
      if (subscriber.confirmed) {
        subscriber.confirmationToken = null; // Clear token if manually confirmed
      }
      await subscriber.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: `Manually updated subscriber confirmation to ${subscriber.confirmed}`,
        content: { subscriber },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while toggling confirmation: ${error.message}`,
        content: null,
      };
    }
  }

  async delete(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'ID người đăng ký không hợp lệ.',
          content: null,
        };
      }

      const subscriber = await this.subscriberModel.findByIdAndDelete(id);

      if (!subscriber) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Không tìm thấy người đăng ký nhận tin này.',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Đã xóa hoàn toàn người đăng ký nhận tin khỏi cơ sở dữ liệu.',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Đã xảy ra sự cố khi xóa người đăng ký: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // HELPER METHODS
  // =========================

  private async sendConfirmationMailSafely(email: string, token: string) {
    try {
      const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
      const confirmLink = `${backendUrl}/api/newsletter-subscriber/confirm?token=${token}`;
      await this.mailService.sendNewsletterConfirmationEmail(email, confirmLink);
    } catch (mailError: any) {
      console.error('[Newsletter Service] Failed to send newsletter confirmation email:', mailError.message);
    }
  }
}
