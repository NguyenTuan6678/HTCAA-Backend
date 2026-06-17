import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LegalDoc, LegalDocSchema } from '../../schema/legal-docs.schema';
import { User, UserSchema } from '../../schema/user.schema';
import { MinioModule } from '../minio/minio.module';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';

import { LegalDocsController } from './legal-docs.controller';
import { LegalDocsService } from './legal-docs.service';
import {
  NewsCategory,
  NewsCategorySchema,
} from '../../schema/news-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LegalDoc.name, schema: LegalDocSchema },
      { name: User.name, schema: UserSchema },
      { name: NewsCategory.name, schema: NewsCategorySchema },
    ]),
    MinioModule,
  ],
  controllers: [LegalDocsController],
  providers: [LegalDocsService, JwtAuthGuard, RolesGuard],
  exports: [LegalDocsService],
})
export class LegalDocsModule {}
