import * as dotenv from 'dotenv';
dotenv.config();
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  // rawBody for Razorpay webhook HMAC. We type the app as Express so we can set
  // body-parser limits without losing the raw-body capture.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Cap request bodies — orders/combos blobs are small; reject anything large.
  const bodyLimit = process.env.BODY_LIMIT || '1mb';
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  // Security headers (CSP off — this is a JSON API, not a server-rendered site).
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Uniform error envelope + safe logging for every unhandled error.
  app.useGlobalFilters(new AllExceptionsFilter());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isProd = process.env.NODE_ENV === 'production';

  // Fail closed: in production we only allow explicitly configured origins.
  // If ALLOWED_ORIGINS is unset in prod, NO cross-origin browser app can call
  // the API (rather than silently reflecting any origin with credentials).
  // In non-production we fall back to reflecting the request origin for DX.
  const corsOrigin = allowedOrigins.length ? allowedOrigins : isProd ? false : true;
  if (isProd && !allowedOrigins.length) {
    new Logger('Bootstrap').warn(
      'ALLOWED_ORIGINS is not set in production — all cross-origin browser requests will be blocked.',
    );
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Close DB connections / in-flight work cleanly on SIGTERM/SIGINT (deploys).
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
}
bootstrap();
