import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Re-enable body parsing for all non-auth routes.
  // bodyParser is disabled globally because better-auth reads the raw body itself.
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/auth')) return next();
    express.json()(req, res, next);
  });
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/auth')) return next();
    express.urlencoded({ extended: true })(req, res, next);
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  app.enableShutdownHooks()

  // Force-exit after 3 s if graceful shutdown stalls (e.g. an open Chromium session
  // prevents the Bull queue from draining cleanly).
  const forceExit = (signal: string) => {
    setTimeout(() => process.exit(0), 3000).unref()
  }
  process.on('SIGTERM', forceExit)
  process.on('SIGINT', forceExit)

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}

bootstrap();
