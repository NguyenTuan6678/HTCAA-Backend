import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateContactDto } from './dto/create-contact.req';
import { QueryContactDto } from './dto/query-contact.req';
import { UpdateContactStatusDto } from './dto/update-contact-status.req';
import { ERROR_RES, ERROR_INFO } from '../../constants/error.const';
import { Contact, ContactStatus } from '../../schema/contact.schema';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<Contact>,
  ) {}

  // =========================
  // PUBLIC
  // =========================

  async submit(dto: CreateContactDto) {
    try {
      const contact = await this.contactModel.create({
        subject: dto.subject,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email.toLowerCase().trim(),
        content: dto.content,
        status: ContactStatus.PENDING,
        isActive: true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Submit contact inquiry successfully',
        content: { contact },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while submitting inquiry: ${error.message}`,
        content: null,
      };
    }
  }

  // =========================
  // ADMIN / EDITOR
  // =========================

  async findAll(query: QueryContactDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.status) {
        filter.status = query.status;
      }

      if (query.q) {
        const regex = new RegExp(query.q, 'i');
        filter.$or = [
          { subject: regex },
          { fullName: regex },
          { email: regex },
        ];
      }

      const [items, total] = await Promise.all([
        this.contactModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.contactModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get contact inquiries successfully',
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
        message: `There is a problem while getting inquiries: ${error.message}`,
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
          message: 'Invalid inquiry id',
          content: null,
        };
      }

      const contact = await this.contactModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!contact) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Contact inquiry not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get contact inquiry detail successfully',
        content: { contact },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting inquiry: ${error.message}`,
        content: null,
      };
    }
  }

  async updateStatus(id: string, dto: UpdateContactStatusDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid inquiry id',
          content: null,
        };
      }

      const contact = await this.contactModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!contact) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Contact inquiry not found',
          content: null,
        };
      }

      const updated = await this.contactModel.findByIdAndUpdate(
        id,
        { status: dto.status },
        { returnDocument: 'after', runValidators: true },
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update contact inquiry status successfully',
        content: { contact: updated },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating inquiry status: ${error.message}`,
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
          message: 'Invalid inquiry id',
          content: null,
        };
      }

      const contact = await this.contactModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!contact) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Contact inquiry not found',
          content: null,
        };
      }

      await this.contactModel.findByIdAndUpdate(id, { isActive: false });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete contact inquiry successfully',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting inquiry: ${error.message}`,
        content: null,
      };
    }
  }
}
