ALTER TABLE "demo"."chat" DROP CONSTRAINT "chat_pkey";--> statement-breakpoint
ALTER TABLE "demo"."chat" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "demo"."chat" ADD COLUMN "id" serial PRIMARY KEY;
