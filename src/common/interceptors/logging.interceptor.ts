import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, originalUrl, ip } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const user = request.user;
          const userIdentifier = user ? `${user.id || user._id} (${user.role || 'User'})` : 'Anonymous';
          const statusCode = response.statusCode;
          const duration = Date.now() - now;
          this.logRequest(method, originalUrl, statusCode, duration, userIdentifier, ip);
        },
        error: (error) => {
          const user = request.user;
          const userIdentifier = user ? `${user.id || user._id} (${user.role || 'User'})` : 'Anonymous';
          const statusCode = error.status || 500;
          const duration = Date.now() - now;
          this.logRequest(method, originalUrl, statusCode, duration, userIdentifier, ip, error.message);
        },
      }),
    );
  }

  private logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    user: string,
    ip: string,
    errorMessage?: string,
  ) {
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';
    const gray = '\x1b[90m';

    // Color for Method
    let methodColor = '\x1b[32m'; // Green for GET
    if (method === 'POST') methodColor = '\x1b[33m'; // Yellow
    if (method === 'PUT' || method === 'PATCH') methodColor = '\x1b[36m'; // Cyan
    if (method === 'DELETE') methodColor = '\x1b[31m'; // Red

    // Color for Status Code
    let statusColor = '\x1b[32m'; // Green for 2xx
    if (statusCode >= 300 && statusCode < 400) statusColor = '\x1b[36m'; // Cyan for 3xx
    if (statusCode >= 400 && statusCode < 500) statusColor = '\x1b[33m'; // Yellow for 4xx
    if (statusCode >= 500) statusColor = '\x1b[31m'; // Red for 5xx

    const logMsg =
      `${methodColor}${bold}${method.padEnd(6)}${reset} ` +
      `${bold}${url}${reset} - ` +
      `Status: ${statusColor}${bold}${statusCode}${reset} - ` +
      `Time: ${gray}${duration}ms${reset} - ` +
      `User: ${user} - ` +
      `IP: ${gray}${ip}${reset}` +
      (errorMessage ? ` - ${statusColor}Error: ${errorMessage}${reset}` : '');

    this.logger.log(logMsg);
  }
}
