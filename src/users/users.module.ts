import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerService } from '../common/loggers/logger.service';
import { User, UserSchema } from '../schema/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from '../repositories/users.repository';
import { JwtAuthGuard } from './auth/guards/auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, LoggerService, JwtAuthGuard],
  exports: [UsersService, UsersRepository, MongooseModule],
})
export class UsersModule {}
