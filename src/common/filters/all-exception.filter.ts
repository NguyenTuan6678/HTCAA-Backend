import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../loggers/logger.service';

interface HttpExceptionResponse {
  message?: string | string[];
  error?: unknown;
}

interface ErrorResponse {
  success: boolean;
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
  errors?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private logger: LoggerService) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let errors: unknown = null;
    if (exception instanceof BadRequestException) {
      status = HttpStatus.BAD_REQUEST;
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        const { message: msg, error } =
          exceptionResponse as HttpExceptionResponse;
        message = Array.isArray(msg) ? msg[0] : msg || 'Invalid data';
        errors = error;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        const { message: msg, error } =
          exceptionResponse as HttpExceptionResponse;
        message = Array.isArray(msg) ? msg[0] : msg || 'Invalid request';
        errors = error;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`Uncaught Exception: ${String(exception)}`, stack);
    }
    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };
    if (errors) {
      errorResponse.errors = errors;
    }
    this.logger.error(
      `[${request.method}] ${request.url} - ${status} - ${message}`,
      undefined,
      'ExceptionFilter',
    );
    response.status(status).json(errorResponse);
  }
}
