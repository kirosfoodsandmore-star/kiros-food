import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";

export type EmailStatus = "sent" | "failed" | "skipped";

export interface NewEmailLog {
  organizationId: string | null;
  to: string;
  subject: string;
  kind: string | null;
  status: EmailStatus;
  provider: string | null;
  note: string | null;
}

export interface EmailLogRowDTO {
  id: string;
  createdAt: string;
  organizationId: string | null;
  restaurantName: string | null;
  to: string;
  subject: string;
  kind: string | null;
  status: EmailStatus;
  provider: string | null;
  note: string | null;
}

/** What to look at. `from` is inclusive and `to` exclusive (so a whole day is [midnight, next midnight)). */
export interface EmailLogCountFilters {
  kind?: string;
  organizationId?: string;
  /** Matches the recipient address or the subject. */
  search?: string;
  from?: Date;
  to?: Date;
}

export interface EmailLogFilters extends EmailLogCountFilters {
  page: number;
  limit: number;
  status?: EmailStatus;
}

/** The email log: one row per recipient. Never holds a message body (see migration EmailLogs). */
export class EmailLogRepository {
  static Instance = new EmailLogRepository();
  private constructor() {}

  async insert(rows: NewEmailLog[]): Promise<void> {
    if (rows.length === 0) return;
    const p = new SqlParams();
    const values = rows.map((r) => `(${[r.organizationId, r.to.slice(0, 255), r.subject.slice(0, 300), r.kind, r.status, r.provider, r.note?.slice(0, 600) ?? null].map((v) => p.add(v)).join(", ")})`);
    await db().query(`INSERT INTO email_logs (organization_id, to_email, subject, kind, status, provider, note) VALUES ${values.join(", ")}`, p.values);
  }

  /** The conditions every view of the log shares. */
  private conditions(f: EmailLogCountFilters, p: SqlParams): string[] {
    const where = ["true"];
    if (f.kind) where.push(`l.kind = ${p.add(f.kind)}`);
    if (f.organizationId) where.push(`l.organization_id = ${p.add(f.organizationId)}`);
    if (f.from) where.push(`l.created_at >= ${p.add(f.from)}`);
    if (f.to) where.push(`l.created_at < ${p.add(f.to)}`);
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(l.to_email ILIKE ${s} OR l.subject ILIKE ${s})`);
    }
    return where;
  }

  async list(f: EmailLogFilters): Promise<PagedRows<EmailLogRowDTO>> {
    const p = new SqlParams();
    const where = this.conditions(f, p);
    if (f.status) where.push(`l.status = ${p.add(f.status)}`);
    const rows = await db().query(
      `SELECT l.id, l.created_at AS "createdAt", l.organization_id AS "organizationId", o.name AS "restaurantName", l.to_email AS "to", l.subject, l.kind,
              l.status, l.provider, l.note, COUNT(*) OVER() AS "__total"
       FROM email_logs l LEFT JOIN organizations o ON o.id = l.organization_id
       WHERE ${where.join(" AND ")} ORDER BY l.created_at DESC, l.id LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<EmailLogRowDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  /** How many emails ended each way within the same filters as the list (the status filter itself is left out, so the counts show the split). */
  async summary(f: EmailLogCountFilters): Promise<Record<EmailStatus, number>> {
    const p = new SqlParams();
    const rows: Array<{ status: EmailStatus; n: number }> = await db().query(
      `SELECT l.status, COUNT(*)::int AS n FROM email_logs l WHERE ${this.conditions(f, p).join(" AND ")} GROUP BY l.status`,
      p.values
    );
    const out: Record<EmailStatus, number> = { sent: 0, failed: 0, skipped: 0 };
    for (const row of rows) out[row.status] = row.n;
    return out;
  }

  async purgeOlderThan(days: number): Promise<number> {
    // A DELETE...RETURNING comes back from the driver as a [rows, count] pair; counting inside a SELECT avoids that.
    const rows: Array<{ n: number }> = await db().query(`WITH gone AS (DELETE FROM email_logs WHERE created_at < now() - make_interval(days => $1) RETURNING 1) SELECT COUNT(*)::int AS n FROM gone`, [days]);
    return rows[0]?.n ?? 0;
  }
}
