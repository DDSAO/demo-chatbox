ALTER TABLE "demo"."chat" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "demo"."chat" ALTER COLUMN "created_at" SET DATA TYPE integer USING (extract(epoch from "created_at"))::integer;--> statement-breakpoint
ALTER TABLE "demo"."chat" ALTER COLUMN "created_at" SET DEFAULT (extract(epoch from now()))::integer;--> statement-breakpoint
ALTER TABLE "demo"."chat" ALTER COLUMN "created_at" SET NOT NULL;
