CREATE TYPE "public"."file_type" AS ENUM('FILE1', 'FILE2', 'FILE3');--> statement-breakpoint
CREATE TYPE "public"."import_batch_status" AS ENUM('RUNNING', 'COMPLETED', 'COMPLETED_WITH_REVIEW', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."import_row_disposition" AS ENUM('CREATED_KOOTAJ', 'CREATED_ITEM', 'SKIPPED_EXISTING', 'LETTER_ATTACHED', 'LETTER_DRAFT_IGNORED', 'UNMATCHED', 'EXTRACTION_FAILED', 'CONFLICT', 'PARENT_FIELD_CONFLICT', 'IGNORED_EMPTY_KEY', 'ERROR', 'REVIEW');--> statement-breakpoint
CREATE TYPE "public"."import_row_processing_status" AS ENUM('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."review_item_status" AS ENUM('OPEN', 'RESOLVED', 'IGNORED');--> statement-breakpoint
CREATE TYPE "public"."review_item_type" AS ENUM('EXTRACTION_FAILED', 'UNMATCHED', 'LETTER_CONFLICT', 'PARENT_FIELD_CONFLICT');--> statement-breakpoint
CREATE TYPE "public"."source_origin" AS ENUM('FILE1', 'FILE2');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('viewer', 'importer', 'reviewer', 'admin');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before_data" jsonb,
	"after_data" jsonb,
	"metadata" jsonb,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_type" "file_type" NOT NULL,
	"status" "import_batch_status" DEFAULT 'RUNNING' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"created_records" integer DEFAULT 0 NOT NULL,
	"skipped_records" integer DEFAULT 0 NOT NULL,
	"review_records" integer DEFAULT 0 NOT NULL,
	"error_records" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"source_row_number" integer NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"normalized_kootaj" text,
	"processing_status" "import_row_processing_status" DEFAULT 'PENDING' NOT NULL,
	"disposition" "import_row_disposition",
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kootaj_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kootaj_id" uuid NOT NULL,
	"line_no" integer,
	"row_item_no" text,
	"tariff_code" text,
	"goods_description" text,
	"gross_weight" numeric(20, 6),
	"net_weight" numeric(20, 6),
	"package_count" numeric(20, 4),
	"package_type" text,
	"manufacturer_country" text,
	"warehouse_receipt_no" text,
	"e_warehouse_receipt_no" text,
	"source_file_type" "file_type" NOT NULL,
	"source_row_number" integer,
	"import_batch_id" uuid,
	"import_row_id" uuid,
	"raw_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kootajs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_kootaj" text NOT NULL,
	"display_kootaj" text,
	"source_origin" "source_origin" NOT NULL,
	"created_import_batch_id" uuid,
	"created_by_user_id" uuid,
	"kootaj_date" text,
	"owner_name" text,
	"owner_code" text,
	"broker_name" text,
	"broker_code" text,
	"declarant_name" text,
	"declarant_code" text,
	"assessment_location" text,
	"declaration_stage" text,
	"rial_value" numeric(20, 4),
	"fx_value" numeric(20, 4),
	"fx_currency" text,
	"fx_rate" numeric(20, 6),
	"customs_inferred_duty" numeric(20, 4),
	"tamlik_deposit" numeric(20, 4),
	"goods_status_text" text,
	"announced_to_tamlik_text" text,
	"exit_text" text,
	"origin_country" text,
	"export_country" text,
	"trade_country" text,
	"order_registration_no" text,
	"has_parent_field_conflict" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kootaj_id" uuid NOT NULL,
	"letter_number" text NOT NULL,
	"letter_number_original" text,
	"letter_date" text,
	"letter_date_original" text,
	"letter_date_source" text,
	"description" text,
	"letter_system_id" text,
	"registrar" text,
	"extraction_method" text,
	"extracted_kootaj_raw" text,
	"import_batch_id" uuid,
	"import_row_id" uuid,
	"attached_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "review_item_type" NOT NULL,
	"status" "review_item_status" DEFAULT 'OPEN' NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"import_row_id" uuid,
	"kootaj_id" uuid,
	"normalized_kootaj" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolution_note" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kootaj_items" ADD CONSTRAINT "kootaj_items_kootaj_id_kootajs_id_fk" FOREIGN KEY ("kootaj_id") REFERENCES "public"."kootajs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kootaj_items" ADD CONSTRAINT "kootaj_items_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kootaj_items" ADD CONSTRAINT "kootaj_items_import_row_id_import_rows_id_fk" FOREIGN KEY ("import_row_id") REFERENCES "public"."import_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kootajs" ADD CONSTRAINT "kootajs_created_import_batch_id_import_batches_id_fk" FOREIGN KEY ("created_import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kootajs" ADD CONSTRAINT "kootajs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_kootaj_id_kootajs_id_fk" FOREIGN KEY ("kootaj_id") REFERENCES "public"."kootajs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_import_row_id_import_rows_id_fk" FOREIGN KEY ("import_row_id") REFERENCES "public"."import_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_attached_by_user_id_users_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_import_row_id_import_rows_id_fk" FOREIGN KEY ("import_row_id") REFERENCES "public"."import_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_kootaj_id_kootajs_id_fk" FOREIGN KEY ("kootaj_id") REFERENCES "public"."kootajs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_import_batch_id_idx" ON "audit_logs" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "import_batches_file_type_idx" ON "import_batches" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_batches_created_by_idx" ON "import_batches" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "import_batches_imported_at_idx" ON "import_batches" USING btree ("imported_at");--> statement-breakpoint
CREATE INDEX "import_rows_import_batch_id_idx" ON "import_rows" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "import_rows_normalized_kootaj_idx" ON "import_rows" USING btree ("normalized_kootaj");--> statement-breakpoint
CREATE INDEX "import_rows_processing_status_idx" ON "import_rows" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "import_rows_disposition_idx" ON "import_rows" USING btree ("disposition");--> statement-breakpoint
CREATE INDEX "kootaj_items_kootaj_id_idx" ON "kootaj_items" USING btree ("kootaj_id");--> statement-breakpoint
CREATE INDEX "kootaj_items_goods_description_idx" ON "kootaj_items" USING btree ("goods_description");--> statement-breakpoint
CREATE INDEX "kootaj_items_tariff_code_idx" ON "kootaj_items" USING btree ("tariff_code");--> statement-breakpoint
CREATE INDEX "kootaj_items_warehouse_receipt_no_idx" ON "kootaj_items" USING btree ("warehouse_receipt_no");--> statement-breakpoint
CREATE INDEX "kootaj_items_import_batch_id_idx" ON "kootaj_items" USING btree ("import_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kootajs_normalized_kootaj_uidx" ON "kootajs" USING btree ("normalized_kootaj");--> statement-breakpoint
CREATE INDEX "kootajs_source_origin_idx" ON "kootajs" USING btree ("source_origin");--> statement-breakpoint
CREATE INDEX "kootajs_owner_name_idx" ON "kootajs" USING btree ("owner_name");--> statement-breakpoint
CREATE INDEX "kootajs_order_registration_no_idx" ON "kootajs" USING btree ("order_registration_no");--> statement-breakpoint
CREATE INDEX "kootajs_created_import_batch_id_idx" ON "kootajs" USING btree ("created_import_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "letters_kootaj_id_uidx" ON "letters" USING btree ("kootaj_id");--> statement-breakpoint
CREATE INDEX "letters_letter_number_idx" ON "letters" USING btree ("letter_number");--> statement-breakpoint
CREATE INDEX "letters_import_batch_id_idx" ON "letters" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "review_items_status_idx" ON "review_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_items_type_idx" ON "review_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "review_items_status_type_idx" ON "review_items" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "review_items_import_batch_id_idx" ON "review_items" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "review_items_kootaj_id_idx" ON "review_items" USING btree ("kootaj_id");--> statement-breakpoint
CREATE INDEX "review_items_normalized_kootaj_idx" ON "review_items" USING btree ("normalized_kootaj");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");