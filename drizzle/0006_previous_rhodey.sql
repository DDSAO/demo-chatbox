-- Session/chat IDs move from integer to uuid. Truncates demo chat + session so existing
-- integer FKs are not orphaned. Remove the TRUNCATE lines if you have a custom data migration.
ALTER TABLE "demo"."chat" DROP CONSTRAINT IF EXISTS "chat_session_id_session_id_fk";--> statement-breakpoint
TRUNCATE TABLE "demo"."chat", "demo"."session";--> statement-breakpoint
ALTER TABLE "demo"."session" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "demo"."session" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();--> statement-breakpoint
ALTER TABLE "demo"."session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "demo"."chat" ALTER COLUMN "session_id" SET DATA TYPE uuid USING gen_random_uuid();--> statement-breakpoint
ALTER TABLE "demo"."chat" ADD CONSTRAINT "chat_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "demo"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
