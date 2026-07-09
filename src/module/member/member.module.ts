import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Member, MemberSchema } from '../../schema/member.schema';
import { User, UserSchema } from '../../schema/user.schema';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { Counter, CounterSchema } from '../../schema/counter.schema';

import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: User.name, schema: UserSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    MinioModule,
  ],
  controllers: [MemberController],
  providers: [MemberService, JwtAuthGuard, RolesGuard],
  exports: [MemberService],
})
export class MemberModule {}
