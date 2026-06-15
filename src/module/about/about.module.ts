import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthGuard } from '../../users/auth/guards/auth.guard';
import { RolesGuard } from '../../users/auth/guards/roles.guard';
import { AboutUs, AboutUsSchema } from '../../schema/about-setting.schema';
import { AboutUsController } from './about.controller';
import { AboutUsService } from './about.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AboutUs.name,
        schema: AboutUsSchema,
      },
    ]),
  ],
  controllers: [AboutUsController],
  providers: [AboutUsService, JwtAuthGuard, RolesGuard],
})
export class AboutUsModule {}
