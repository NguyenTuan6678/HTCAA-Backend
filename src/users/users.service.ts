import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.req';
import { QueryUserDto } from './dto/query-user.req';
import { UpdateUserDto } from './dto/update-user.req';
import { ERROR_RES, ERROR_INFO } from '../constants/error.const';
import { User } from '../schema/user.schema';
import { LoggerService } from '../common/loggers/logger.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModal: Model<User>,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateUserDto) {
    try {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.userModal.findOne({ email });

      if (existing) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Email already exists',
          content: null,
        };
      }

      const user = new this.userModal({
        name: dto.name,
        email,
        password: dto.password,
        role: dto.role,
        memberType: dto.memberType ?? 'member',
        isActive: true,
      });

      await user.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create user successfully',
        content: {
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            memberType: user.memberType,
            isActive: user.isActive,
          },
        },
      };
    } catch (error: any) {
      this.logger.error(`Error creating user: ${error.message}`);
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating user: ${error.message}`,
        content: null,
      };
    }
  }

  async findAll(query: QueryUserDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (query.isActive !== undefined) {
        filter.isActive = query.isActive;
      }

      if (query.role) {
        filter.role = query.role;
      }

      if (query.q) {
        const regex = new RegExp(query.q, 'i');
        filter.$or = [{ name: regex }, { email: regex }];
      }

      const [items, total] = await Promise.all([
        this.userModal
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.userModal.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get users successfully',
        content: {
          items,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching users: ${error.message}`);
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting users: ${error.message}`,
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
          message: 'Invalid user ID',
          content: null,
        };
      }

      const user = await this.userModal.findById(id);

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get user successfully',
        content: { user },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching user details: ${error.message}`);
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting user details: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user ID',
          content: null,
        };
      }

      const user = await this.userModal.findById(id).select('+password');

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found',
          content: null,
        };
      }

      if (dto.email !== undefined) {
        const email = dto.email.toLowerCase().trim();
        if (email !== user.email) {
          const conflict = await this.userModal.findOne({ email });
          if (conflict) {
            return {
              code: ERROR_RES.CONFLICT_ERROR.statusCode,
              info: ERROR_INFO.FAIL,
              message: 'Email already exists',
              content: null,
            };
          }
          user.email = email;
        }
      }

      if (dto.name !== undefined) {
        user.name = dto.name;
      }

      if (dto.password !== undefined) {
        user.password = dto.password;
      }

      if (dto.role !== undefined) {
        user.role = dto.role;
      }

      if (dto.memberType !== undefined) {
        user.memberType = dto.memberType;
      }

      if (dto.isActive !== undefined) {
        user.isActive = dto.isActive;
      }

      await user.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update user successfully',
        content: {
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            memberType: user.memberType,
            isActive: user.isActive,
          },
        },
      };
    } catch (error: any) {
      this.logger.error(`Error updating user: ${error.message}`);
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating user: ${error.message}`,
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
          message: 'Invalid user ID',
          content: null,
        };
      }

      const user = await this.userModal.findById(id);

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found',
          content: null,
        };
      }

      user.isActive = false;
      await user.save();

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete user successfully',
        content: null,
      };
    } catch (error: any) {
      this.logger.error(`Error deleting user: ${error.message}`);
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting user: ${error.message}`,
        content: null,
      };
    }
  }
}
