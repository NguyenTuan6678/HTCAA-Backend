import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';
import { Faq, FaqSchema } from '../schema/faqs.schema';
import { JwtAuthGuard } from '../users/auth/guards/auth.guard';
import { RolesGuard } from '../users/auth/guards/roles.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: Faq.name, schema: FaqSchema }])],
  controllers: [FaqsController],
  providers: [FaqsService, JwtAuthGuard, RolesGuard],
  exports: [FaqsService],
})
export class FaqsModule {}
