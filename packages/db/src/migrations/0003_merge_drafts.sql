CREATE TYPE "public"."merge_draft_status" AS ENUM('AWAITING_RESOLUTION', 'APPLIED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "merge_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_type" "file_type" NOT NULL,
	"status" "merge_draft_status" DEFAULT 'AWAITING_RESOLUTION' NOT NULL,
	"created_by" uuid,
	"report" jsonb NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "merge_drafts" ADD CONSTRAINT "merge_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_drafts" ADD CONSTRAINT "merge_drafts_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merge_drafts_status_idx" ON "merge_drafts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merge_drafts_created_by_idx" ON "merge_drafts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "merge_drafts_created_at_idx" ON "merge_drafts" USING btree ("created_at");
