import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { News, NewsSchema } from '../../schema/news.schema';
import { User, UserSchema } from '../../schema/user.schema';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import {
  NewsCategory,
  NewsCategorySchema,
} from '../../schema/news-category.schema';
import {
  NewsComment,
  NewsCommentSchema,
} from '../../schema/news-comment.schema';
import { MinioModule } from '../minio/minio.module';
import { MailModule } from '../mail/mail.module';
import { NewsletterSubscriberModule } from '../newsletter-subscriber/newsletter-subscriber.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: News.name, schema: NewsSchema },
      { name: User.name, schema: UserSchema },
      { name: NewsCategory.name, schema: NewsCategorySchema },
      { name: NewsComment.name, schema: NewsCommentSchema },
    ]),
    MinioModule,
    MailModule,
    NewsletterSubscriberModule,
  ],
  controllers: [NewsController],
  providers: [NewsService, JwtAuthGuard, RolesGuard],
  exports: [NewsService],
})
export class NewsModule {}
