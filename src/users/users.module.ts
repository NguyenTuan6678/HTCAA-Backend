import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerService } from '../common/loggers/logger.service';
import { User, UserSchema } from '../schema/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from './auth/guards/auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService, LoggerService, JwtAuthGuard],
  exports: [UsersService, MongooseModule],
})
export class UsersModule { }
