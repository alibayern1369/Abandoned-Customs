-- Append-only enforcement for audit_logs (application must also never UPDATE/DELETE)
CREATE OR REPLACE FUNCTION prevent_audit_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % not allowed', TG_OP;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_immutable_update ON audit_logs;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_logs_immutable_delete ON audit_logs;
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_logs_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_logs_mutation();
