import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MinioModule } from '../module/minio/minio.module';
import { DocumentFile, DocumentFileSchema } from '../schema/documents.schema';
import {
  NewsCategory,
  NewsCategorySchema,
} from '../schema/news-category.schema';
import { JwtAuthGuard } from '../users/auth/guards/auth.guard';
import { RolesGuard } from '../users/auth/guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentFile.name, schema: DocumentFileSchema },
      { name: NewsCategory.name, schema: NewsCategorySchema },
    ]),
    MinioModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, JwtAuthGuard, RolesGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
