import { Module } from '@nestjs/common';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AboutSetting,
  AboutSettingSchema,
} from '../../schema/about-setting.schema';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AboutSetting.name,
        schema: AboutSettingSchema,
      },
    ]),
    MinioModule,
  ],
  controllers: [AboutController],
  providers: [AboutService, JwtAuthGuard, RolesGuard],
})
export class AboutModule {}
