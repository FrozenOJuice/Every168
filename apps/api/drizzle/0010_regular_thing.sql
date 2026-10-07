CREATE TABLE "admin_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_action" CHECK ("admin_audit"."action" in ('admin_created','suspended','reactivated','sessions_revoked'))
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_type" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "user_created_idx" ON "users" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "user_active_idx" ON "users" USING btree ("last_active_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "user_access_values" CHECK ("users"."account_type" in ('user','admin') and "users"."version">0 and ("users"."account_type"='user' or "users"."suspended_at" is null));--> statement-breakpoint
CREATE FUNCTION users_access_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'Account type is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at OR NEW.version IS DISTINCT FROM OLD.version THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_access_integrity BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION users_access_integrity();
--> statement-breakpoint
CREATE FUNCTION sessions_active_user() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE blocked timestamptz;
BEGIN
  -- Serialize session creation with suspension/revocation; FK locks alone do not protect non-key updates.
  SELECT suspended_at INTO blocked FROM users WHERE id=NEW.user_id FOR SHARE;
  IF blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Account is unavailable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER sessions_active_user BEFORE INSERT OR UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION sessions_active_user();
--> statement-breakpoint
CREATE FUNCTION admin_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit history is immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER admin_audit_immutable BEFORE UPDATE OR DELETE ON admin_audit FOR EACH ROW EXECUTE FUNCTION admin_audit_immutable();
