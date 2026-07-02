import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './users/auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from './config/config.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { MemberModule } from './module/member/member.module';
import { NewsModule } from './module/news/news.module';
// import { HomepageModule } from './module/homepage/homepage.module';
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
    AppConfigModule,
    MemberModule,
    NewsModule,
    // HomepageModule,
    CourseModule,
    AboutUsModule,
    UploadModule,
    MinioModule,
    LegalDocsModule,
    FaqsModule,
    DocumentsModule,
    ContactModule,
    NewsletterSubscriberModule,
    RegistrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
