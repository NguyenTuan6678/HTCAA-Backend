import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  MembershipRegistration,
  MembershipRegistrationSchema,
} from '../../schema/membership-registration.schema';

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
    ]),
  ],
  controllers: [MembershipRegistrationController],
  providers: [MembershipRegistrationService, JwtAuthGuard, RolesGuard],
  exports: [MembershipRegistrationService],
})
export class MembershipRegistrationModule {}
