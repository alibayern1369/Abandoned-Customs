-- audit_logs is append-only; ON DELETE SET NULL would UPDATE rows and trip the trigger.
-- Restrict batch deletion while audit rows still reference the batch.
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_import_batch_id_import_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;
