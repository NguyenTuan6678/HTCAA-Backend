import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './users/auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppConfigModule } from './config/config.module';
import { MemberModule } from './module/member/member.module';
import { NewsModule } from './module/news/news.module';
import { CourseModule } from './module/course/course.module';
import { AboutUsModule } from './module/about/about.module';
import { LegalDocsModule } from './module/legal-docs/legal-docs.module';
import { UploadModule } from './module/upload/upload.module';
import { MinioModule } from './module/minio/minio.module';
import { FaqsModule } from './module/faqs/faqs.module';
import { DocumentsModule } from './module/documents/documents.module';
import { ContactModule } from './module/contact/contact.module';
import { NewsletterSubscriberModule } from './module/newsletter-subscriber/newsletter-subscriber.module';
import { RegistrationModule } from './module/registration/registration.module';
import { MembershipRegistrationModule } from './module/membership-registration/membership-registration.module';
import { SocialPostModule } from './module/social-post/social-post.module';
import { PartnerModule } from './module/partner/partner.module';
import { ShutdownService } from './common/shutdowns/shutdown.service';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('app.mongodb.uri'),
        dbName: configService.get<string>('app.mongodb.name'),
        retryAttempts: 5,
        retryDelay: 1000,
      }),
    }),
    AuthModule,
    UsersModule,
    AboutUsModule,
    NewsModule,
    LegalDocsModule,
    DocumentsModule,
    ContactModule,
    FaqsModule,
    PartnerModule,
    SocialPostModule,
    AppConfigModule,
    MemberModule,
    MembershipRegistrationModule,
    RegistrationModule,
    CourseModule,
    RegistrationModule,
    NewsletterSubscriberModule,
    UploadModule,
    MinioModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ShutdownService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
