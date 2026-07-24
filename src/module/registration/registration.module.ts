import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import {
  Registration,
  RegistrationSchema,
} from '../../schema/registration.schema';
import { Course, CourseSchema } from '../../schema/course.schema';
import { User, UserSchema } from '../../schema/user.schema';
import { Member, MemberSchema } from '../../schema/member.schema';
import { Counter, CounterSchema } from '../../schema/counter.schema';
import { MinioModule } from '../minio/minio.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Registration.name, schema: RegistrationSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    MinioModule,
    MailModule,
  ],
  providers: [RegistrationService, JwtAuthGuard, RolesGuard],
  controllers: [RegistrationController],
})
export class RegistrationModule {}
