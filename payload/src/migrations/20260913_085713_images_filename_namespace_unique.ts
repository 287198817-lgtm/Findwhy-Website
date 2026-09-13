import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "images_filename_idx";
  CREATE UNIQUE INDEX "images_filename_compound_idx" ON "images" USING btree ("prefix","filename");
  CREATE INDEX "images_filename_idx" ON "images" USING btree ("filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "images_filename_compound_idx";
  DROP INDEX "images_filename_idx";
  CREATE UNIQUE INDEX "images_filename_idx" ON "images" USING btree ("filename");`)
}
