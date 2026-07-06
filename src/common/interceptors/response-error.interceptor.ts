import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'code' in data) {
          const code = Number(data.code);
          if (code >= 400 && code < 600) {
            throw new HttpException(
              {
                statusCode: code,
                message: data.message || 'Error occurred',
                error: data.info || 'FAIL',
              },
              code,
            );
          }
        }
        return data;
      }),
    );
  }
}
