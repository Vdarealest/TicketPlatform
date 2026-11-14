import { MigrationInterface, QueryRunner } from 'typeorm';

// user.phone is UNIQUE, and updateProfile used to store "" when a user
// cleared their phone. Only one row can hold "", so every later user saving
// a profile without a phone got a 500. The code now writes NULL; this fixes
// rows written before that.
export class NullEmptyPhone1794647857678 implements MigrationInterface {
  name = 'NullEmptyPhone1794647857678';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "user" SET "phone" = NULL WHERE "phone" = ''`,
    );
  }

  public async down(): Promise<void> {
    // Nothing to undo: NULL is the correct value for "no phone".
  }
}
