import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "images" ADD COLUMN "sizes_card_url" varchar;
  ALTER TABLE "images" ADD COLUMN "sizes_card_width" numeric;
  ALTER TABLE "images" ADD COLUMN "sizes_card_height" numeric;
  ALTER TABLE "images" ADD COLUMN "sizes_card_mime_type" varchar;
  ALTER TABLE "images" ADD COLUMN "sizes_card_filesize" numeric;
  ALTER TABLE "images" ADD COLUMN "sizes_card_filename" varchar;
  CREATE INDEX "images_sizes_card_sizes_card_filename_idx" ON "images" USING btree ("sizes_card_filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "images_sizes_card_sizes_card_filename_idx";
  ALTER TABLE "images" DROP COLUMN "sizes_card_url";
  ALTER TABLE "images" DROP COLUMN "sizes_card_width";
  ALTER TABLE "images" DROP COLUMN "sizes_card_height";
  ALTER TABLE "images" DROP COLUMN "sizes_card_mime_type";
  ALTER TABLE "images" DROP COLUMN "sizes_card_filesize";
  ALTER TABLE "images" DROP COLUMN "sizes_card_filename";`)
}
