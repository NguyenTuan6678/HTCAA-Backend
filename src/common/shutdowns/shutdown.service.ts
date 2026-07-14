import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  BeforeApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class ShutdownService
  implements OnModuleDestroy, BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(ShutdownService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private getMongooseState(stateNum: number): string {
    const states: Record<number, string> = {
      0: 'DISCONNECTED',
      1: 'CONNECTED',
      2: 'CONNECTING',
      3: 'DISCONNECTING',
    };
    return states[stateNum] || 'UNKNOWN';
  }

  onModuleDestroy() {
    this.logger.warn('[SHUTDOWN] onModuleDestroy triggered - Initiating cleanup of modules...');
    const dbState = this.getMongooseState(this.connection.readyState);
    this.logger.log(`[SHUTDOWN] Mongoose database connection state: ${dbState}`);
  }

  beforeApplicationShutdown(signal?: string) {
    this.logger.warn(
      `[SHUTDOWN] beforeApplicationShutdown triggered. Signal: ${signal ?? 'SIGTERM/SIGINT'}`,
    );
    this.logger.log('[SHUTDOWN] Stopping incoming HTTP traffic and API requests...');
    this.logger.log('[SHUTDOWN] Processing active background jobs and system tasks...');
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.warn(
      `[SHUTDOWN] onApplicationShutdown triggered. Signal: ${signal ?? 'SIGTERM/SIGINT'}`,
    );

    const dbStateBefore = this.getMongooseState(this.connection.readyState);
    this.logger.log(`[SHUTDOWN] Database state before application exit: ${dbStateBefore}`);

    // If connection is still active, we can explicitly close it
    if (this.connection.readyState === 1) {
      this.logger.log('[SHUTDOWN] Closing active Mongoose connection...');
      await this.connection.close();
      this.logger.log('[SHUTDOWN] Mongoose connection closed successfully.');
    }

    const dbStateAfter = this.getMongooseState(this.connection.readyState);
    this.logger.log(`[SHUTDOWN] Database state after application exit: ${dbStateAfter}`);
    this.logger.log('[SHUTDOWN] NestJS microservices and connections closed successfully.');
  }
}
