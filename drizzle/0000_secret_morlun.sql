CREATE SCHEMA "demo";
--> statement-breakpoint
CREATE TABLE "demo"."chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chat_created_at_idx" ON "demo"."chat" USING btree ("created_at");