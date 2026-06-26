import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.req';
import { QueryUserDto } from './dto/query-user.req';
import { UpdateUserDto } from './dto/update-user.req';
import { ERROR_RES, ERROR_INFO } from '../constants/error.const';
import { User } from '../schema/user.schema';
import { LoggerService } from '../common/loggers/logger.service';
import { Role } from '../utils/role/role';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateUserDto) {
    try {
      if (dto.role === Role.ADMIN) {
        throw new BadRequestException('Cannot create admin user');
      }

      const email = dto.email.toLowerCase().trim();
      const existing = await this.userModel.findOne({ email });

      if (existing) {
        throw new ConflictException('Email already exists');
      }

      const user = new this.userModel({
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
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while creating user: ${error.message}`,
      );
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
        this.userModel
          .find(filter)
          .select('name email role memberType isActive createdAt updatedAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.userModel.countDocuments(filter),
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
      throw new InternalServerErrorException(
        `There is a problem while getting users: ${error.message}`,
      );
    }
  }

  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid user ID');
      }

      const user = await this.userModel
        .findById(id)
        .select('name email role memberType isActive createdAt updatedAt');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get user successfully',
        content: { user },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching user details: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while getting user details: ${error.message}`,
      );
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid user ID');
      }

      const user = await this.userModel.findById(id).select('+password');

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (dto.email !== undefined) {
        const email = dto.email.toLowerCase().trim();
        if (email !== user.email) {
          const conflict = await this.userModel.findOne({ email });
          if (conflict) {
            throw new ConflictException('Email already exists');
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
        if (dto.role === Role.ADMIN) {
          throw new BadRequestException('Cannot assign admin role to user');
        }
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
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while updating user: ${error.message}`,
      );
    }
  }

  async deactivate(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid user ID');
      }

      const user = await this.userModel.findById(id);

      if (!user) {
        throw new NotFoundException('User not found');
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `There is a problem while deleting user: ${error.message}`,
      );
    }
  }
}
