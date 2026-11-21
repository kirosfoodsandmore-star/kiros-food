import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A record of the emails the platform sent (or tried to, or chose not to), for the platform admins.
 *  - email_logs: one row per recipient: when, which restaurant, who, the subject, what kind of email, the outcome
 *    (sent / failed / skipped), how it went out (Gmail or the Apps Script relay) and a short note (the error, or why it was
 *    skipped). The message BODY is never stored: bodies carry one-time codes and delivery codes. Old rows are deleted
 *    automatically (see modules/notification/services/emailLog.service.ts).
 */
export class EmailLogs1794500000014 implements MigrationInterface {
  name = "EmailLogs1794500000014";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "email_logs" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
      "to_email" varchar(255) NOT NULL,
      "subject" varchar(300) NOT NULL,
      "kind" varchar(40),
      "status" varchar(10) NOT NULL,
      "provider" varchar(20),
      "note" varchar(600),
      CONSTRAINT "PK_email_logs" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_email_logs_status" CHECK ("status" IN ('sent', 'failed', 'skipped'))
    )`);
    await q.query(`CREATE INDEX "IDX_email_logs_created" ON "email_logs" ("created_at" DESC)`);
    await q.query(`CREATE INDEX "IDX_email_logs_status" ON "email_logs" ("status", "created_at" DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "email_logs"`);
  }
}
