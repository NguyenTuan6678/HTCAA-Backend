import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Partner, PartnerSchema } from '../../schema/partner.schema';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Partner.name, schema: PartnerSchema }]),
    MinioModule,
  ],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
