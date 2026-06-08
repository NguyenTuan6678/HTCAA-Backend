import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  BeforeApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';

@Injectable()
export class ShutdownService
  implements OnModuleDestroy, BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(ShutdownService.name);

  onModuleDestroy() {
    this.logger.warn('[SHUTDOWN] onModuleDestroy triggered');
  }

  beforeApplicationShutdown(signal?: string) {
    this.logger.warn(
      `[SHUTDOWN] beforeApplicationShutdown triggered. Signal: ${signal ?? 'unknown'}`,
    );

    this.logger.log('[SHUTDOWN] Stopping new incoming operations...');
    this.logger.log('[SHUTDOWN] Waiting for current tasks to finish...');
  }

  onApplicationShutdown(signal?: string) {
    this.logger.warn(
      `[SHUTDOWN] onApplicationShutdown triggered. Signal: ${signal ?? 'unknown'}`,
    );

    this.logger.log('[SHUTDOWN] Application closed successfully');
  }
}
