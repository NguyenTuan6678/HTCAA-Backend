import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SocialPost, SocialPostSchema } from '../../schema/social-post.schema';
import { SocialPostController } from './social-post.controller';
import { SocialPostService } from './social-post.service';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SocialPost.name, schema: SocialPostSchema },
    ]),
    MinioModule,
  ],
  controllers: [SocialPostController],
  providers: [SocialPostService],
  exports: [SocialPostService],
})
export class SocialPostModule {}
