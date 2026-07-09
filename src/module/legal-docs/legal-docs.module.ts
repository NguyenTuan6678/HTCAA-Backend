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
  LegalDocsCategory,
  LegalDocsCategorySchema,
} from '../../schema/legal-docs-category.schema';
import {
  TypeCategory,
  TypeCategorySchema,
} from '../../schema/category-type.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LegalDoc.name, schema: LegalDocSchema },
      { name: User.name, schema: UserSchema },
      { name: LegalDocsCategory.name, schema: LegalDocsCategorySchema },
      { name: TypeCategory.name, schema: TypeCategorySchema },
    ]),
    MinioModule,
  ],
  controllers: [LegalDocsController],
  providers: [LegalDocsService, JwtAuthGuard, RolesGuard],
  exports: [LegalDocsService],
})
export class LegalDocsModule {}
