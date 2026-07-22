import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (CSP, HSTS, X-Frame-Options, no-sniff, …).
  // crossOriginResourcePolicy stays 'cross-origin' so the frontend (a
  // different origin) can load /uploads images — that's unrelated to CSP,
  // which only governs what THIS server's own HTML/JS would be allowed to
  // load, so helmet's default CSP is safe to keep here.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Allow the frontend origin. Configurable so prod isn't stuck on localhost.
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // whitelist: strip properties not declared in DTOs (blocks mass-assignment)
  // forbidNonWhitelisted: reject requests that send unknown properties
  // transform: coerce payloads to their DTO types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`🔌 WebSocket CORS origin: ${frontendUrl}`);
}

bootstrap();