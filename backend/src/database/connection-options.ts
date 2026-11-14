import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

// Shared by the Nest app (app.module.ts) and the TypeORM CLI (data-source.ts)
// so both always point at the same database with the same settings.
export function connectionOptions(): PostgresConnectionOptions {
  return {
    type: 'postgres',
    // Managed Postgres (Render, Neon, Supabase…) exposes one connection URL;
    // the discrete DB_* vars stay for local development.
    ...(process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        }),
    // Hosted Postgres requires TLS, but issues certs from a private CA that
    // isn't in the container's trust store, hence rejectUnauthorized: false.
    ...(process.env.DB_SSL === 'true'
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
    // Schema changes go through migrations only. synchronize can silently
    // drop or retype columns, so it is off everywhere, including dev.
    synchronize: false,
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  };
}
