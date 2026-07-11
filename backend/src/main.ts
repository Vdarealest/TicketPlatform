import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (HSTS, X-Frame-Options, no-sniff, …).
  // Allow cross-origin loading of /uploads assets by the frontend, and drop the
  // default CSP (it applies to API/static responses and would block those images).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
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