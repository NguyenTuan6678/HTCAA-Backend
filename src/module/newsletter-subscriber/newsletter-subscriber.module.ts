import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { NewsletterSubscriberController } from './newsletter-subscriber.controller';
import { NewsletterSubscriberService } from './newsletter-subscriber.service';
import { MailModule } from '../mail/mail.module';
import {
  NewsletterSubscriber,
  NewsletterSubscriberSchema,
} from '../../schema/newsletter-subscriber.schema';

@Module({
  imports: [
    MailModule,
    MongooseModule.forFeature([
      { name: NewsletterSubscriber.name, schema: NewsletterSubscriberSchema },
    ]),
  ],
  controllers: [NewsletterSubscriberController],
  providers: [NewsletterSubscriberService],
  exports: [NewsletterSubscriberService],
})
export class NewsletterSubscriberModule {}
