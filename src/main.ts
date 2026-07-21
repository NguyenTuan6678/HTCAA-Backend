import 'dotenv/config';
declare const module: any;
import { join } from 'path';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { LoggerService } from './common/loggers/logger.service';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { ResponseErrorInterceptor } from './common/interceptors/response-error.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { printServerBanner } from './banner/server-banner';
import { SecurityRedirectMiddleware } from './middleware/security-redirect.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.NODE_ENV === 'production') {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'", process.env.FRONTEND_URL || "'self'"],
          },
        },
        crossOriginResourcePolicy: {
          policy: 'cross-origin',
        },
        strictTransportSecurity: {
          maxAge: 31536000,
          includeSubDomains: true,
        },
        xFrameOptions: false,
      }),
    );
  } else {
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: {
          policy: 'cross-origin',
        },
        strictTransportSecurity: false,
        xFrameOptions: false,
      }),
    );
  }

  const logger = new LoggerService();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      skipMissingProperties: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  const allExceptionsFilter = new AllExceptionsFilter(logger);
  app.useGlobalFilters(allExceptionsFilter);
  app.useGlobalInterceptors(
    new ResponseErrorInterceptor(),
    new LoggingInterceptor(),
  );

  app.use(cookieParser());
  app.use(new SecurityRedirectMiddleware().use);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    credentials: true,
  });

  app.enableShutdownHooks();

  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('HTCAA API')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'authorization',
    )
    .setDescription('The HTCAA API Development by HTCAA')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  printServerBanner(port);
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
