import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schema/user.schema';
import { CreateUsersDTO } from '../users/dto/create-users.req';
import { QueryUserDto } from '../users/dto/query-users.req';
import { Role } from '../utils/role/role';
import { LoggerService } from '../common/loggers/logger.service';

type CreateUserPayload = CreateUsersDTO & {
  role: Role;
};

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private logger: LoggerService,
  ) {}

  async create(createUserDto: CreateUserPayload): Promise<UserDocument> {
    try {
      const newUser = new this.userModel(createUserDto);
      const savedUser = await newUser.save();
      this.logger.log(`User created: ${savedUser.username}`, 'UserRepository');
      return savedUser;
    } catch (error: any) {
      this.logger.error(`Error creating user: ${error.message}`, undefined);
      throw error;
    }
  }

  async findAllWithFilters(query: QueryUserDto): Promise<{
    data: UserDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { isActive, role, search } = query;

      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = {};

      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      if (role) {
        filter.role = role;
      }

      if (search) {
        const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        filter.$or = [
          {
            username: {
              $regex: safeSearch,
              $options: 'i',
            },
          },
        ];
      }

      const [data, total] = await Promise.all([
        this.userModel
          .find(filter)
          .select('-password')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .exec(),

        this.userModel.countDocuments(filter).exec(),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      this.logger.error(`Error finding users with filters: ${error.message}`);
      throw error;
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findById(id).exec();
    } catch (error: any) {
      this.logger.error(`Error finding user by ID: ${error.message}`);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ username }).exec();
    } catch (error: any) {
      this.logger.error(`Error finding user by username: ${error.message}`);
      throw error;
    }
  }

  async update(
    id: string,
    updateData: Partial<CreateUsersDTO>,
  ): Promise<UserDocument | null> {
    try {
      const updateUser = await this.userModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();
      if (updateUser) {
        this.logger.error('User updated successfully', 'UserRepository');
      }
      return updateUser;
    } catch (error: any) {
      this.logger.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }

  async delete(id: string): Promise<UserDocument | null> {
    try {
      const deleteUser = await this.userModel.findByIdAndDelete(id).exec();
      if (deleteUser) {
        this.logger.error('User deleted successfully', 'UserRepository');
      }
      return deleteUser;
    } catch (error: any) {
      this.logger.error(`Error deleting user: ${error.message}`);
      throw error;
    }
  }

  async countAll(): Promise<number> {
    try {
      return await this.userModel.countDocuments().exec();
    } catch (error: any) {
      this.logger.error(`Error counting users: ${error.message}`);
      throw error;
    }
  }
}
