import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { MinioModule } from '../minio/minio.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [MinioModule],
  controllers: [UploadController],
  providers: [UploadService, JwtAuthGuard, RolesGuard],
  exports: [UploadService],
})
export class UploadModule {}
