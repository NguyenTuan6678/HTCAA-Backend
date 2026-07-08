import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Course, CourseSchema } from '../../schema/course.schema';
import { User, UserSchema } from '../../schema/user.schema';
import {
  CourseCategory,
  CourseCategorySchema,
} from '../../schema/course-category.schema';

import { CourseController } from './course.controller';
import { CourseService } from './course.service';

import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Course.name,
        schema: CourseSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: CourseCategory.name,
        schema: CourseCategorySchema,
      },
    ]),
  ],
  controllers: [CourseController],
  providers: [CourseService, JwtAuthGuard, RolesGuard],
  exports: [CourseService],
})
export class CourseModule {}
