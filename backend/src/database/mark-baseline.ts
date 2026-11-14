import dataSource from '../data-source';
import { MigrationExecutor } from 'typeorm';

// One-off for a database whose tables were created by the old synchronize
// setup: records the pending migrations as already applied instead of running
// them (running InitialSchema there would fail on CREATE TABLE).
//
// Safe to point at production: it refuses to mark anything unless the live
// schema already matches the entities exactly, so it can never paper over a
// real difference.
async function main() {
  await dataSource.initialize();
  try {
    const diff = await dataSource.driver.createSchemaBuilder().log();
    if (diff.upQueries.length > 0) {
      console.error(
        'Schema does NOT match the entities — nothing was marked. Differences:\n',
      );
      for (const q of diff.upQueries) console.error('  ' + q.query);
      console.error(
        '\nEmpty database? Use `migration:run` instead. Otherwise resolve these first.',
      );
      process.exitCode = 1;
      return;
    }

    const executor = new MigrationExecutor(dataSource);
    // Creates the migrations table if it doesn't exist yet.
    await executor.showMigrations();
    const pending = await executor.getPendingMigrations();
    if (pending.length === 0) {
      console.log('No pending migrations — already baselined.');
      return;
    }
    for (const migration of pending) {
      await executor.insertMigration(migration);
      console.log(`Marked as applied: ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
