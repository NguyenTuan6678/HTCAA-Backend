import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MinioModule } from '../minio/minio.module';
import { MailModule } from '../mail/mail.module';
import {
  MembershipRegistration,
  MembershipRegistrationSchema,
} from '../../schema/membership-registration.schema';
import { Member, MemberSchema } from '../../schema/member.schema';
import { Counter, CounterSchema } from '../../schema/counter.schema';
import { User, UserSchema } from '../../schema/user.schema';
import { MembershipRegistrationController } from './membership-registration.controller';
import { MembershipRegistrationService } from './membership-registration.service';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: MembershipRegistration.name,
        schema: MembershipRegistrationSchema,
      },
      {
        name: Member.name,
        schema: MemberSchema,
      },
      {
        name: Counter.name,
        schema: CounterSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
    MinioModule,
    MailModule,
  ],
  controllers: [MembershipRegistrationController],
  providers: [MembershipRegistrationService, JwtAuthGuard, RolesGuard],
  exports: [MembershipRegistrationService],
})
export class MembershipRegistrationModule {}
