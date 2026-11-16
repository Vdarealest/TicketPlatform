import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { frontendUrl } = configureApp(app);

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Listening on port ${port}`);
  logger.log(`CORS / WebSocket origin: ${frontendUrl}`);
}

void bootstrap();
