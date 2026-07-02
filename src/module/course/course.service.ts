import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Course } from '../../schema/course.schema';
import { User } from '../../schema/user.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';

import { CreateCourseDto } from './dto/create-course.req';
import { QueryCourseDto } from './dto/query-course.req';
import { CourseStatus } from '../../utils/course-status.enum';
import { UpdateCourseDto } from './dto/update-course.req';
import { escapeRegex } from '../../utils/escape-regex';

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<Course>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  private getPopulateQuery() {
    return {
      path: 'createdBy',
      model: User.name,
      select: 'name email role',
    };
  }

  async create(userId: string, createCourseDto: CreateCourseDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
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

      const course = await this.courseModel.create({
        createdBy: new Types.ObjectId(userId),
        title: createCourseDto.title,
        date: new Date(createCourseDto.date),
        location: createCourseDto.location ?? null,
        learningType: createCourseDto.learningType ?? null,
        duration: createCourseDto.duration ?? null,
        taxHours: createCourseDto.taxHours ?? 0,
        accountingHours: createCourseDto.accountingHours ?? 0,
        totalSeats: createCourseDto.totalSeats ?? null,
        price: createCourseDto.price ?? 0,
        memberPrice: createCourseDto.memberPrice,
        registeredSeats: 0,
        status: createCourseDto.status ?? CourseStatus.DRAFT,
        isActive: true,
      });

      const populatedCourse = await this.courseModel
        .findById(course._id)
        .populate(this.getPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create course successfully',
        content: {
          course: populatedCourse,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating course: ${error.message}`,
        content: null,
      };
    }
  }

  async findAll(query: QueryCourseDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const skip = (page - 1) * limit;

      const filter: any = {
        isActive: true,
      };

      if (query.status) {
        filter.status = query.status;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');

        filter.$or = [{ title: regex }, { location: regex }];
      }

      const [items, total] = await Promise.all([
        this.courseModel
          .find(filter)
          .populate(this.getPopulateQuery())
          .sort({ date: 1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.courseModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get courses successfully',
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
        message: `There is a problem while getting courses: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, updateCourseDto: UpdateCourseDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid course id',
          content: null,
        };
      }

      const course = await this.courseModel.findOne({
        _id: new Types.ObjectId(id),
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

      const updateData: any = {};

      if (updateCourseDto.title !== undefined) {
        updateData.title = updateCourseDto.title;
      }

      if (updateCourseDto.date !== undefined) {
        updateData.date = new Date(updateCourseDto.date);
      }

      if (updateCourseDto.location !== undefined) {
        updateData.location = updateCourseDto.location;
      }

      if (updateCourseDto.learningType !== undefined) {
        updateData.learningType = updateCourseDto.learningType;
      }

      if (updateCourseDto.duration !== undefined) {
        updateData.duration = updateCourseDto.duration;
      }

      if (updateCourseDto.taxHours !== undefined) {
        updateData.taxHours = updateCourseDto.taxHours;
      }

      if (updateCourseDto.accountingHours !== undefined) {
        updateData.accountingHours = updateCourseDto.accountingHours;
      }

      if (updateCourseDto.totalSeats !== undefined) {
        updateData.totalSeats = updateCourseDto.totalSeats;
      }

      if (updateCourseDto.price !== undefined) {
        updateData.price = updateCourseDto.price;
      }

      if (updateCourseDto.memberPrice !== undefined) {
        updateData.memberPrice = updateCourseDto.memberPrice;
      }

      if (updateCourseDto.status !== undefined) {
        updateData.status = updateCourseDto.status;
      }

      const updatedCourse = await this.courseModel
        .findByIdAndUpdate(id, updateData, {
          returnDocument: 'after',
          runValidators: true,
        })
        .populate(this.getPopulateQuery());

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update course successfully',
        content: {
          course: updatedCourse,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating course: ${error.message}`,
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
          message: 'Invalid course id',
          content: null,
        };
      }

      const deletedCourse = await this.courseModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
            isActive: true,
          },
          {
            isActive: false,
          },
          {
            returnDocument: 'after',
          },
        )
        .populate(this.getPopulateQuery());

      if (!deletedCourse) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete course successfully',
        content: {
          course: deletedCourse,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting course: ${error.message}`,
        content: null,
      };
    }
  }
}
