import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Registration } from '../../schema/registration.schema';
import { Member } from '../../schema/member.schema';
import { Course } from '../../schema/course.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { MemberStatus } from '../../utils/member-status.enum';
import {
  RegistrationPaymentStatus,
  RegistrationStatus,
} from '../../utils/registration-status.enum';
import { CancelRegistrationDto } from './dto/cancel-registration.req';
import { QueryAdminRegistrationDto } from './dto/query-admin-registration.req';
import { RegisterCourseDto } from './dto/registration-course.req';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectModel(Registration.name)
    private readonly registrationModel: Model<Registration>,
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
  ) {}

  // ─── Member đăng ký khóa học ──────────────────────────────────────────────
  async register(userId: string, registerDto: RegisterCourseDto) {
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

      const member = await this.memberModel.findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!member) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'Member profile not found. Please register as a member first',
          content: null,
        };
      }

      if (member.status !== MemberStatus.ACTIVE) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Only active members can register for courses',
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
        memberId: member._id,
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

      const registration = await this.registrationModel.create({
        memberId: member._id,
        courseId: course._id,
        status: RegistrationStatus.PENDING,
        paymentStatus: RegistrationPaymentStatus.UNPAID,
        note: registerDto.note ?? null,
        isActive: true,
      });

      // Giữ chỗ ngay khi đăng ký (PENDING) để tránh oversell trong lúc chờ
      // admin xác nhận. Nếu nghiệp vụ chỉ muốn giữ chỗ khi CONFIRMED thì
      // chuyển đoạn $inc này sang hàm confirm() bên dưới.
      await this.courseModel.findByIdAndUpdate(course._id, {
        $inc: { registeredSeats: 1 },
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Register course successfully',
        content: {
          registrationId: registration._id.toString(),
          status: registration.status,
        },
      };
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

  // ─── Danh sách khóa học đã đăng ký của member hiện tại ────────────────────
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

      const member = await this.memberModel.findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!member) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Member profile not found',
          content: null,
        };
      }

      const registrations = await this.registrationModel
        .find({ memberId: member._id, isActive: true })
        .populate({
          path: 'courseId',
          select: 'title date location learningType status',
        })
        .sort({ createdAt: -1 });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get my registrations successfully',
        content: { items: registrations },
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

  // ─── Hủy đăng ký (member tự hủy hoặc admin hủy thay) ──────────────────────
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

      const registration = await this.registrationModel.findById(id);

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Registration not found',
          content: null,
        };
      }

      // Chỉ chủ sở hữu đăng ký mới được tự hủy - kiểm tra qua memberId.userId
      const member = await this.memberModel.findById(registration.memberId);

      if (!member || member.userId.toString() !== userId) {
        return {
          code: ERROR_RES.FORBIDDEN_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'You are not allowed to cancel this registration',
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

      // Nhả chỗ lại cho khóa học
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

  // ─── Admin xác nhận đăng ký (PENDING -> CONFIRMED) ────────────────────────
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

  // ─── Admin xem toàn bộ danh sách đăng ký ──────────────────────────────────
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

      const [items, total] = await Promise.all([
        this.registrationModel
          .find(filter)
          .populate({ path: 'memberId', select: 'name memberCode email phone' })
          .populate({ path: 'courseId', select: 'title date status' })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.registrationModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get admin registration list successfully',
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
        message: `There is a problem while getting admin registration list: ${error.message}`,
        content: null,
      };
    }
  }
}
