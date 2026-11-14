import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { frontendUrl } = configureApp(app);

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`Server running on http://localhost:${port}`);
  console.log(`WebSocket CORS origin: ${frontendUrl}`);
}

bootstrap();
