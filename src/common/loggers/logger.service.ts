import { Injectable, Logger as NestLogger } from '@nestjs/common';

@Injectable()
export class LoggerService extends NestLogger {
  debug(message: string, context?: string) {
    if (process.env.NODE_ENV === 'development') {
      super.debug(message, context);
    }
  }

  log(message: string, context?: string) {
    super.log(message, context);
  }

  warn(message: string, context?: string) {
    super.warn(message, context);
  }

  error(message: string, trace?: string, context?: string) {
    super.error(message, trace, context);
  }
}
