CREATE TABLE "demo"."session" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now()))::integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demo"."chat" ADD COLUMN "session_id" integer NOT NULL;--> statement-breakpoint
CREATE INDEX "session_created_at_idx" ON "demo"."session" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "demo"."chat" ADD CONSTRAINT "chat_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "demo"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_session_id_idx" ON "demo"."chat" USING btree ("session_id");