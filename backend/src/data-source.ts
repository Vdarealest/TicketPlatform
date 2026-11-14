import 'dotenv/config';
import { DataSource } from 'typeorm';
import { connectionOptions } from './database/connection-options';

// Entry point for the TypeORM CLI (migration:generate / run / revert).
// The app uses autoLoadEntities instead; the CLI has no Nest container, so it
// finds entities by file name.
export default new DataSource({
  ...connectionOptions(),
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
});
