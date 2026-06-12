import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  HomepageSetting,
  HomepageSettingSchema,
} from '../../schema/homepage-setting.schema';

import { News, NewsSchema } from '../../schema/news.schema';
import {
  NewsCategory,
  NewsCategorySchema,
} from '../../schema/news-category.schema';
import { User, UserSchema } from '../../schema/user.schema';
import { Member, MemberSchema } from '../../schema/member.schema';

import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { MinioModule } from '../minio/minio.module';
import { CourseModule } from '../course/course.module';
import { Course, CourseSchema } from '../../schema/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: HomepageSetting.name,
        schema: HomepageSettingSchema,
      },
      {
        name: News.name,
        schema: NewsSchema,
      },
      {
        name: NewsCategory.name,
        schema: NewsCategorySchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Member.name,
        schema: MemberSchema,
      },
      {
        name: Course.name,
        schema: CourseSchema,
      },
    ]),
    MinioModule,
  ],
  controllers: [HomepageController],
  providers: [HomepageService, JwtAuthGuard, RolesGuard],
  exports: [HomepageService],
})
export class HomepageModule {}
