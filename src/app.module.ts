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
import { HomepageModule } from './module/homepage/homepage.module';
import { CourseModule } from './module/course/course.module';
import { AboutUsModule } from './module/about/about.module';

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
    HomepageModule,
    CourseModule,
    AboutUsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
