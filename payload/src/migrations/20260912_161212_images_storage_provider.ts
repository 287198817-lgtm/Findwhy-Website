import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_images_storage_provider" AS ENUM('vercel-blob', 'aliyun-oss');
  ALTER TABLE "images" ADD COLUMN "storage_provider" "enum_images_storage_provider";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "images" DROP COLUMN "storage_provider";
  DROP TYPE "public"."enum_images_storage_provider";`)
}
