import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "users_sessions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "created_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "email" varchar NOT NULL,
    "reset_password_token" varchar,
    "reset_password_expiration" timestamp(3) with time zone,
    "salt" varchar,
    "hash" varchar,
    "login_attempts" numeric DEFAULT 0,
    "lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "images" (
    "id" serial PRIMARY KEY NOT NULL,
    "alt" varchar,
    "metadata_caption" varchar,
    "metadata_copyright" varchar,
    "metadata_source" varchar,
    "prefix" varchar DEFAULT 'images',
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
    "focal_y" numeric,
    "sizes_thumbnail_url" varchar,
    "sizes_thumbnail_width" numeric,
    "sizes_thumbnail_height" numeric,
    "sizes_thumbnail_mime_type" varchar,
    "sizes_thumbnail_filesize" numeric,
    "sizes_thumbnail_filename" varchar,
    "sizes_portfolio_url" varchar,
    "sizes_portfolio_width" numeric,
    "sizes_portfolio_height" numeric,
    "sizes_portfolio_mime_type" varchar,
    "sizes_portfolio_filesize" numeric,
    "sizes_portfolio_filename" varchar
  );

  CREATE TABLE "videos" (
    "id" serial PRIMARY KEY NOT NULL,
    "alt" varchar,
    "poster_id" integer,
    "prefix" varchar DEFAULT 'videos',
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

  CREATE TABLE "illustrations" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar,
    "image_id" integer NOT NULL,
    "order" numeric,
    "draft" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "animations" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar,
    "video_id" integer NOT NULL,
    "poster_id" integer,
    "order" numeric,
    "draft" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "series" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar NOT NULL,
    "title_zh" varchar NOT NULL,
    "title_en" varchar NOT NULL,
    "description_zh" varchar,
    "description_en" varchar,
    "year" numeric,
    "cover_id" integer NOT NULL,
    "cover_image_id" integer,
    "order" numeric,
    "draft" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "series_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "images_id" integer,
    "videos_id" integer
  );

  CREATE TABLE "projects_services" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "service" varchar NOT NULL
  );

  CREATE TABLE "projects" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar NOT NULL,
    "title_zh" varchar NOT NULL,
    "title_en" varchar,
    "description_zh" varchar,
    "description_en" varchar,
    "year" numeric,
    "category" varchar,
    "cover_image_id" integer,
    "order" numeric,
    "draft" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "projects_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "images_id" integer,
    "videos_id" integer
  );

  CREATE TABLE "payload_kv" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "global_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer,
    "images_id" integer,
    "videos_id" integer,
    "illustrations_id" integer,
    "animations_id" integer,
    "series_id" integer,
    "projects_id" integer
  );

  CREATE TABLE "payload_preferences" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar,
    "value" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer
  );

  CREATE TABLE "payload_migrations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "batch" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "about_intro_zh" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "about_intro_en" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "about_services_zh" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "about_services_en" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "about_clients" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "about" (
    "id" serial PRIMARY KEY NOT NULL,
    "portrait_id" integer,
    "services_title_zh" varchar NOT NULL,
    "services_title_en" varchar NOT NULL,
    "clients_title_zh" varchar NOT NULL,
    "clients_title_en" varchar NOT NULL,
    "contact_title_zh" varchar NOT NULL,
    "contact_title_en" varchar NOT NULL,
    "email" varchar NOT NULL,
    "instagram_url" varchar NOT NULL,
    "xiaohongshu_url" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_poster_id_images_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "animations" ADD CONSTRAINT "animations_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "animations" ADD CONSTRAINT "animations_poster_id_images_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series" ADD CONSTRAINT "series_cover_id_images_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series" ADD CONSTRAINT "series_cover_image_id_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series_rels" ADD CONSTRAINT "series_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "series_rels" ADD CONSTRAINT "series_rels_images_fk" FOREIGN KEY ("images_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "series_rels" ADD CONSTRAINT "series_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_services" ADD CONSTRAINT "projects_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_cover_image_id_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_images_fk" FOREIGN KEY ("images_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_images_fk" FOREIGN KEY ("images_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_illustrations_fk" FOREIGN KEY ("illustrations_id") REFERENCES "public"."illustrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_animations_fk" FOREIGN KEY ("animations_id") REFERENCES "public"."animations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_series_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_intro_zh" ADD CONSTRAINT "about_intro_zh_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_intro_en" ADD CONSTRAINT "about_intro_en_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_services_zh" ADD CONSTRAINT "about_services_zh_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_services_en" ADD CONSTRAINT "about_services_en_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_clients" ADD CONSTRAINT "about_clients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_portrait_id_images_id_fk" FOREIGN KEY ("portrait_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "images_updated_at_idx" ON "images" USING btree ("updated_at");
  CREATE INDEX "images_created_at_idx" ON "images" USING btree ("created_at");
  CREATE UNIQUE INDEX "images_filename_idx" ON "images" USING btree ("filename");
  CREATE INDEX "images_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "images" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "images_sizes_portfolio_sizes_portfolio_filename_idx" ON "images" USING btree ("sizes_portfolio_filename");
  CREATE INDEX "videos_poster_idx" ON "videos" USING btree ("poster_id");
  CREATE INDEX "videos_updated_at_idx" ON "videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");
  CREATE UNIQUE INDEX "videos_filename_idx" ON "videos" USING btree ("filename");
  CREATE UNIQUE INDEX "illustrations_slug_idx" ON "illustrations" USING btree ("slug");
  CREATE INDEX "illustrations_image_idx" ON "illustrations" USING btree ("image_id");
  CREATE INDEX "illustrations_order_idx" ON "illustrations" USING btree ("order");
  CREATE INDEX "illustrations_updated_at_idx" ON "illustrations" USING btree ("updated_at");
  CREATE INDEX "illustrations_created_at_idx" ON "illustrations" USING btree ("created_at");
  CREATE UNIQUE INDEX "animations_slug_idx" ON "animations" USING btree ("slug");
  CREATE INDEX "animations_video_idx" ON "animations" USING btree ("video_id");
  CREATE INDEX "animations_poster_idx" ON "animations" USING btree ("poster_id");
  CREATE INDEX "animations_order_idx" ON "animations" USING btree ("order");
  CREATE INDEX "animations_updated_at_idx" ON "animations" USING btree ("updated_at");
  CREATE INDEX "animations_created_at_idx" ON "animations" USING btree ("created_at");
  CREATE UNIQUE INDEX "series_slug_idx" ON "series" USING btree ("slug");
  CREATE INDEX "series_cover_idx" ON "series" USING btree ("cover_id");
  CREATE INDEX "series_cover_image_idx" ON "series" USING btree ("cover_image_id");
  CREATE INDEX "series_order_idx" ON "series" USING btree ("order");
  CREATE INDEX "series_updated_at_idx" ON "series" USING btree ("updated_at");
  CREATE INDEX "series_created_at_idx" ON "series" USING btree ("created_at");
  CREATE INDEX "series_rels_order_idx" ON "series_rels" USING btree ("order");
  CREATE INDEX "series_rels_parent_idx" ON "series_rels" USING btree ("parent_id");
  CREATE INDEX "series_rels_path_idx" ON "series_rels" USING btree ("path");
  CREATE INDEX "series_rels_images_id_idx" ON "series_rels" USING btree ("images_id");
  CREATE INDEX "series_rels_videos_id_idx" ON "series_rels" USING btree ("videos_id");
  CREATE INDEX "projects_services_order_idx" ON "projects_services" USING btree ("_order");
  CREATE INDEX "projects_services_parent_id_idx" ON "projects_services" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");
  CREATE INDEX "projects_cover_image_idx" ON "projects" USING btree ("cover_image_id");
  CREATE INDEX "projects_order_idx" ON "projects" USING btree ("order");
  CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");
  CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");
  CREATE INDEX "projects_rels_order_idx" ON "projects_rels" USING btree ("order");
  CREATE INDEX "projects_rels_parent_idx" ON "projects_rels" USING btree ("parent_id");
  CREATE INDEX "projects_rels_path_idx" ON "projects_rels" USING btree ("path");
  CREATE INDEX "projects_rels_images_id_idx" ON "projects_rels" USING btree ("images_id");
  CREATE INDEX "projects_rels_videos_id_idx" ON "projects_rels" USING btree ("videos_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_images_id_idx" ON "payload_locked_documents_rels" USING btree ("images_id");
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");
  CREATE INDEX "payload_locked_documents_rels_illustrations_id_idx" ON "payload_locked_documents_rels" USING btree ("illustrations_id");
  CREATE INDEX "payload_locked_documents_rels_animations_id_idx" ON "payload_locked_documents_rels" USING btree ("animations_id");
  CREATE INDEX "payload_locked_documents_rels_series_id_idx" ON "payload_locked_documents_rels" USING btree ("series_id");
  CREATE INDEX "payload_locked_documents_rels_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("projects_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "about_intro_zh_order_idx" ON "about_intro_zh" USING btree ("_order");
  CREATE INDEX "about_intro_zh_parent_id_idx" ON "about_intro_zh" USING btree ("_parent_id");
  CREATE INDEX "about_intro_en_order_idx" ON "about_intro_en" USING btree ("_order");
  CREATE INDEX "about_intro_en_parent_id_idx" ON "about_intro_en" USING btree ("_parent_id");
  CREATE INDEX "about_services_zh_order_idx" ON "about_services_zh" USING btree ("_order");
  CREATE INDEX "about_services_zh_parent_id_idx" ON "about_services_zh" USING btree ("_parent_id");
  CREATE INDEX "about_services_en_order_idx" ON "about_services_en" USING btree ("_order");
  CREATE INDEX "about_services_en_parent_id_idx" ON "about_services_en" USING btree ("_parent_id");
  CREATE INDEX "about_clients_order_idx" ON "about_clients" USING btree ("_order");
  CREATE INDEX "about_clients_parent_id_idx" ON "about_clients" USING btree ("_parent_id");
  CREATE INDEX "about_portrait_idx" ON "about" USING btree ("portrait_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "images" CASCADE;
  DROP TABLE "videos" CASCADE;
  DROP TABLE "illustrations" CASCADE;
  DROP TABLE "animations" CASCADE;
  DROP TABLE "series" CASCADE;
  DROP TABLE "series_rels" CASCADE;
  DROP TABLE "projects_services" CASCADE;
  DROP TABLE "projects" CASCADE;
  DROP TABLE "projects_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "about_intro_zh" CASCADE;
  DROP TABLE "about_intro_en" CASCADE;
  DROP TABLE "about_services_zh" CASCADE;
  DROP TABLE "about_services_en" CASCADE;
  DROP TABLE "about_clients" CASCADE;
  DROP TABLE "about" CASCADE;`)
}
