import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3001',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(
    `🚀 Server running on http://localhost:${port}`,
  );

  console.log(
    '🔌 WebSocket enabled with CORS origin: http://localhost:3001',
  );
}

bootstrap();