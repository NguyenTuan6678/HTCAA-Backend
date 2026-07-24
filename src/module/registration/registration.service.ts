import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Registration } from '../../schema/registration.schema';
import { Member } from '../../schema/member.schema';
import { Course } from '../../schema/course.schema';
import { User } from '../../schema/user.schema';
import { Counter } from '../../schema/counter.schema';
import { MinioService } from '../minio/minio.service';
import { MailService } from '../mail/mail.service';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { MemberStatus } from '../../utils/member-status.enum';
import {
  RegistrationPaymentStatus,
  RegistrationStatus,
} from '../../utils/registration-status.enum';
import { CancelRegistrationDto } from './dto/cancel-registration.req';
import { QueryAdminRegistrationDto } from './dto/query-admin-registration.req';
import { RegisterCourseDto } from './dto/registration-course.req';
import { GuestRegisterCourseDto } from './dto/guest-registration-course.req';
import { VerifyMembershipDto } from './dto/verify-membership.req';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectModel(Registration.name)
    private readonly registrationModel: Model<Registration>,
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    private readonly minioService: MinioService,
    private readonly mailService: MailService,
  ) {}

  private async attachPaymentProofUrl<T extends Record<string, any>>(
    item: T,
  ): Promise<T> {
    if (!item) return item;
    const obj = typeof (item as any).toObject === 'function' ? (item as any).toObject() : { ...item };
    if (obj.paymentProof) {
      obj.paymentProof = await this.minioService.attachPresignedUrl(obj.paymentProof);
    }
    return obj as T;
  }

  private async attachPaymentProofUrlToList(items: any[]): Promise<any[]> {
    return Promise.all(items.map((i) => this.attachPaymentProofUrl(i)));
  }

  private async generateRegistrationCode(): Promise<string> {
    const year = new Date().getFullYear();
    const key = `COURSE_REG_${year}`;

    const counter = await this.counterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const seq = String(counter.seq).padStart(5, '0');
    return `KC-${year}-${seq}`;
  }

  async register(
    userId: string,
    registerDto: RegisterCourseDto,
    file?: Express.Multer.File,
  ) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      if (!Types.ObjectId.isValid(registerDto.courseId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid course id',
          content: null,
        };
      }

      const user = await this.userModel.findOne({
        _id: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found or inactive',
          content: null,
        };
      }

      const course = await this.courseModel.findOne({
        _id: registerDto.courseId,
        isActive: true,
      });

      if (!course) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      if (
        course.totalSeats != null &&
        course.registeredSeats >= course.totalSeats
      ) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course is full',
          content: null,
        };
      }

      const existing = await this.registrationModel.findOne({
        userId: new Types.ObjectId(userId),
        courseId: course._id,
        status: { $ne: RegistrationStatus.CANCELLED },
      });

      if (existing) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You have already registered for this course',
          content: null,
        };
      }

      const courseUpdateCondition: any = {
        _id: course._id,
        isActive: true,
      };

      if (course.totalSeats != null) {
        courseUpdateCondition.registeredSeats = { $lt: course.totalSeats };
      }

      const updatedCourse = await this.courseModel.findOneAndUpdate(
        courseUpdateCondition,
        { $inc: { registeredSeats: 1 } },
        { new: true },
      );

      if (!updatedCourse) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course is full',
          content: null,
        };
      }

      const hasIncremented = true;

      try {
        const member = await this.memberModel.findOne({
          userId: new Types.ObjectId(userId),
          isActive: true,
        });

        const isMember = !!member && member.status === MemberStatus.ACTIVE;

        const price = isMember
          ? (course.memberPrice ?? course.price)
          : course.price;

        const registrationCode = await this.generateRegistrationCode();

        let paymentProof: any = null;
        if (file) {
          paymentProof = await this.minioService.uploadFile(
            file,
            'course-registrations',
          );
        }

        const registration = await this.registrationModel.create({
          userId: new Types.ObjectId(userId),
          memberId: isMember ? member!._id : null,
          courseId: course._id,
          registrationCode,
          status: RegistrationStatus.PENDING,
          paymentStatus: RegistrationPaymentStatus.UNPAID,
          price,
          paymentProof,
          note: registerDto.note ?? null,
          registrant: {
            name: user.name,
            email: user.email,
            dateOfBirth: new Date(registerDto.dateOfBirth),
            phoneNumber: registerDto.phoneNumber,
            taxCodeActive: registerDto.taxCodeActive,
            taxCodeActiveDate: new Date(registerDto.taxCodeActiveDate),
            isMember,
            companyName: registerDto.companyName,
            taxId: registerDto.taxId,
            addressExportBill: registerDto.addressExportBill,
            emailExportBill: registerDto.emailExportBill,
          },
          isActive: true,
        });

        let responsePaymentProof = paymentProof;
        if (responsePaymentProof) {
          responsePaymentProof = await this.minioService.attachPresignedUrl(
            responsePaymentProof,
          );
        }

        return {
          code: ERROR_RES.SUCCESS.statusCode,
          info: ERROR_INFO.SUCCESS,
          message: 'Register course successfully',
          content: {
            registrationId: registration._id.toString(),
            registrationCode: registration.registrationCode,
            status: registration.status,
            price: registration.price,
            isMember,
            paymentProof: responsePaymentProof,
          },
        };
      } catch (innerError) {
        if (hasIncremented) {
          await this.courseModel.findByIdAndUpdate(course._id, {
            $inc: { registeredSeats: -1 },
          });
        }
        throw innerError;
      }
    } catch (error: any) {
      if (error?.code === 11000) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You have already registered for this course',
          content: null,
        };
      }

      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while registering course: ${error.message}`,
        content: null,
      };
    }
  }

  async guestRegister(
    dto: GuestRegisterCourseDto,
    file?: Express.Multer.File,
  ) {
    try {
      if (!Types.ObjectId.isValid(dto.courseId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid course id',
          content: null,
        };
      }

      const course = await this.courseModel.findOne({
        _id: dto.courseId,
        isActive: true,
      });

      if (!course) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      const email = dto.email.trim().toLowerCase();

      const existing = await this.registrationModel.findOne({
        courseId: course._id,
        'registrant.email': email,
        status: { $ne: RegistrationStatus.CANCELLED },
      });

      if (existing) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'This email has already registered for this course',
          content: null,
        };
      }

      const courseUpdateCondition: any = {
        _id: course._id,
        isActive: true,
      };

      if (course.totalSeats != null) {
        courseUpdateCondition.registeredSeats = { $lt: course.totalSeats };
      }

      const updatedCourse = await this.courseModel.findOneAndUpdate(
        courseUpdateCondition,
        { $inc: { registeredSeats: 1 } },
        { new: true },
      );

      if (!updatedCourse) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course is full',
          content: null,
        };
      }

      const hasIncremented = true;

      try {
        const registrationCode = await this.generateRegistrationCode();

        let paymentProof: any = null;
        if (file) {
          paymentProof = await this.minioService.uploadFile(
            file,
            'course-registrations',
          );
        }

        const registration = await this.registrationModel.create({
          userId: null,
          memberId: null,
          courseId: course._id,
          registrationCode,
          status: RegistrationStatus.PENDING,
          paymentStatus: RegistrationPaymentStatus.UNPAID,
          price: null,
          membershipVerified: false,
          paymentProof,
          note: dto.note ?? null,
          registrant: {
            name: dto.name,
            email,
            dateOfBirth: new Date(dto.dateOfBirth),
            phoneNumber: dto.phoneNumber,
            taxCodeActive: dto.taxCodeActive,
            taxCodeActiveDate: new Date(dto.taxCodeActiveDate),
            isMember: null,
            claimedIsMember: dto.claimedIsMember,
            companyName: dto.companyName,
            taxId: dto.taxId,
            addressExportBill: dto.addressExportBill,
            emailExportBill: dto.emailExportBill,
          },
          isActive: true,
        });

        let responsePaymentProof = paymentProof;
        if (responsePaymentProof) {
          responsePaymentProof = await this.minioService.attachPresignedUrl(
            responsePaymentProof,
          );
        }

        return {
          code: ERROR_RES.SUCCESS.statusCode,
          info: ERROR_INFO.SUCCESS,
          message:
            'Đăng ký thành công. Thông tin của bạn đang chờ được xác thực.',
          content: {
            registrationId: registration._id.toString(),
            registrationCode: registration.registrationCode,
            paymentProof: responsePaymentProof,
          },
        };
      } catch (innerError) {
        if (hasIncremented) {
          await this.courseModel.findByIdAndUpdate(course._id, {
            $inc: { registeredSeats: -1 },
          });
        }
        throw innerError;
      }
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while registering course: ${error.message}`,
        content: null,
      };
    }
  }

  async me(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      const registrations = await this.registrationModel
        .find({ userId: new Types.ObjectId(userId), isActive: true })
        .populate({
          path: 'courseId',
          select: 'title date location learningType status',
        })
        .sort({ createdAt: -1 });

      const itemsWithUrls = await this.attachPaymentProofUrlToList(
        registrations,
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get my registrations successfully',
        content: { items: itemsWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting my registrations: ${error.message}`,
        content: null,
      };
    }
  }

  async cancel(id: string, userId: string, cancelDto: CancelRegistrationDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid registration id',
          content: null,
        };
      }

      const registration = await this.registrationModel.findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Registration not found or unauthorized',
          content: null,
        };
      }

      if (registration.status === RegistrationStatus.CANCELLED) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'This registration has already been cancelled',
          content: null,
        };
      }

      registration.status = RegistrationStatus.CANCELLED;
      registration.cancelledAt = new Date();
      registration.cancelReason = cancelDto.cancelReason ?? null;
      await registration.save();

      await this.courseModel.findByIdAndUpdate(registration.courseId, {
        $inc: { registeredSeats: -1 },
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Cancel registration successfully',
        content: { registration },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while cancelling registration: ${error.message}`,
        content: null,
      };
    }
  }

  async verifyMembership(id: string, dto: VerifyMembershipDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid registration id',
          content: null,
        };
      }

      const registration = await this.registrationModel.findById(id);

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Registration not found',
          content: null,
        };
      }

      if (registration.userId) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'This registration belongs to a logged-in user and is already verified',
          content: null,
        };
      }

      const course = await this.courseModel.findById(registration.courseId);

      if (!course) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      const price = dto.isMember
        ? (course.memberPrice ?? course.price)
        : course.price;

      registration.registrant.isMember = dto.isMember;
      registration.price = price;
      registration.membershipVerified = true;
      await registration.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Verify membership successfully',
        content: { registration },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while verifying membership: ${error.message}`,
        content: null,
      };
    }
  }

  async approveGuestRegistration(id: string, dto: VerifyMembershipDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid registration id',
          content: null,
        };
      }

      const registration = await this.registrationModel.findById(id);

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Registration not found',
          content: null,
        };
      }

      if (registration.userId) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'This registration belongs to a logged-in user. Use PATCH /:id/confirm instead.',
          content: null,
        };
      }

      if (registration.status !== RegistrationStatus.PENDING) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: `Cannot approve a registration with status "${registration.status}". Only PENDING registrations can be approved.`,
          content: null,
        };
      }

      const course = await this.courseModel.findById(registration.courseId);

      if (!course) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      const price = dto.isMember
        ? (course.memberPrice ?? course.price)
        : course.price;

      registration.registrant.isMember = dto.isMember;
      registration.price = price;
      registration.membershipVerified = true;
      registration.status = RegistrationStatus.CONFIRMED;
      registration.confirmedAt = new Date();
      await registration.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Approve guest registration successfully',
        content: { registration },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while approving guest registration: ${error.message}`,
        content: null,
      };
    }
  }

  async confirm(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid registration id',
          content: null,
        };
      }

      const registration = await this.registrationModel.findById(id);

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Registration not found',
          content: null,
        };
      }

      if (registration.status !== RegistrationStatus.PENDING) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: `Cannot confirm a registration with status "${registration.status}". Only PENDING registrations can be confirmed.`,
          content: null,
        };
      }

      if (!registration.userId && !registration.membershipVerified) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'This is a guest registration pending membership verification. Please call /verify-membership first, or use PATCH /:id/approve-guest to verify and confirm in one step.',
          content: null,
        };
      }

      registration.status = RegistrationStatus.CONFIRMED;
      registration.confirmedAt = new Date();
      await registration.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Confirm registration successfully',
        content: { registration },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while confirming registration: ${error.message}`,
        content: null,
      };
    }
  }

  async adminFindAll(query: QueryAdminRegistrationDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.status) {
        filter.status = query.status;
      }

      if (query.courseId) {
        if (!Types.ObjectId.isValid(query.courseId)) {
          return {
            code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
            info: ERROR_INFO.FAIL,
            message: 'Invalid course id',
            content: null,
          };
        }
        filter.courseId = query.courseId;
      }

      if (query.memberId) {
        if (!Types.ObjectId.isValid(query.memberId)) {
          return {
            code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
            info: ERROR_INFO.FAIL,
            message: 'Invalid member id',
            content: null,
          };
        }
        filter.memberId = query.memberId;
      }

      if (query.membershipVerified !== undefined) {
        filter.membershipVerified = query.membershipVerified;
      }

      if (query.registrationCode) {
        filter.registrationCode = new RegExp(query.registrationCode.trim(), 'i');
      }

      if (query.search) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { registrationCode: searchRegex },
          { 'registrant.name': searchRegex },
          { 'registrant.email': searchRegex },
          { 'registrant.phoneNumber': searchRegex },
        ];
      }

      const [items, total] = await Promise.all([
        this.registrationModel
          .find(filter)
          .populate({ path: 'userId', select: 'name email' })
          .populate({ path: 'memberId', select: 'name memberCode email phone' })
          .populate({ path: 'courseId', select: 'title date status location learningType price memberPrice' })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.registrationModel.countDocuments(filter),
      ]);

      const itemsWithUrls = await this.attachPaymentProofUrlToList(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get admin registration list successfully',
        content: {
          items: itemsWithUrls,
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
        message: `There is a problem while getting admin registration list: ${error.message}`,
        content: null,
      };
    }
  }

  async confirmPayment(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid registration id',
          content: null,
        };
      }

      const registration = await this.registrationModel
        .findById(id)
        .populate('courseId');

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Registration not found',
          content: null,
        };
      }

      if (registration.paymentStatus === RegistrationPaymentStatus.PAID) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'This registration payment has already been confirmed',
          content: null,
        };
      }

      const course: any = registration.courseId;

      registration.paymentStatus = RegistrationPaymentStatus.PAID;
      if (registration.status === RegistrationStatus.PENDING) {
        registration.status = RegistrationStatus.CONFIRMED;
        registration.confirmedAt = new Date();
      }
      await registration.save();

      const registrationWithUrl = await this.attachPaymentProofUrl(
        registration,
      );

      const email = registration.registrant?.email;
      const name = registration.registrant?.name;
      if (email && name) {
        this.mailService
          .sendCourseRegistrationPaymentConfirmation(
            email,
            name,
            registration.registrationCode || '',
            course?.title || 'Khóa học',
            registration.price ?? course?.price ?? 0,
            course?.date,
            course?.location,
            course?.learningType,
          )
          .catch((err) => {
            console.error(
              'Error sending course payment confirmation email:',
              err,
            );
          });
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Confirm payment and send confirmation email successfully',
        content: { registration: registrationWithUrl },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while confirming payment: ${error.message}`,
        content: null,
      };
    }
  }
}
