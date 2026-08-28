import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "web_videos" (
    "id" serial PRIMARY KEY NOT NULL,
    "prefix" varchar DEFAULT 'video-web',
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "url" varchar,
    "thumbnail_u_r_l" varchar,
    "filename" varchar,
    "mime_type" varchar,
    "filesize" numeric,
    "width" numeric,
    "height" numeric,
    "focal_x" numeric,
    "focal_y" numeric
  );

  ALTER TABLE "videos" ADD COLUMN "web_video_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "web_videos_id" integer;
  CREATE INDEX "web_videos_updated_at_idx" ON "web_videos" USING btree ("updated_at");
  CREATE INDEX "web_videos_created_at_idx" ON "web_videos" USING btree ("created_at");
  CREATE UNIQUE INDEX "web_videos_filename_idx" ON "web_videos" USING btree ("filename");
  ALTER TABLE "videos" ADD CONSTRAINT "videos_web_video_id_web_videos_id_fk" FOREIGN KEY ("web_video_id") REFERENCES "public"."web_videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_web_videos_fk" FOREIGN KEY ("web_videos_id") REFERENCES "public"."web_videos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "videos_web_video_idx" ON "videos" USING btree ("web_video_id");
  CREATE INDEX "payload_locked_documents_rels_web_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("web_videos_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos" DROP CONSTRAINT "videos_web_video_id_web_videos_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_web_videos_fk";

  DROP INDEX "videos_web_video_idx";
  DROP INDEX "payload_locked_documents_rels_web_videos_id_idx";
  ALTER TABLE "videos" DROP COLUMN "web_video_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "web_videos_id";
  DROP TABLE "web_videos";`)
}
