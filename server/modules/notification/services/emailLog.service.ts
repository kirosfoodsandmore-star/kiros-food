// The email log (Platform → Email log, platform admins only): what the platform tried to email, to whom, and how it went.
// Recording must never get in the way of sending, so every failure here (the table isn't there yet, the database blinked)
// is swallowed with one warning. What is NOT recorded: message bodies, and the text of any subject that carries a code.
import { EmailLogRepository, type NewEmailLog } from "../repositories/emailLog.repository";

/** What a message is, for filtering and for a human reading the log. */
export type MailKind =
  | "welcome"
  | "staff_invite"
  | "password_reset"
  | "password_changed"
  | "access_removed"
  | "contact_message"
  | "sign_in_code"
  | "transfer_instructions"
  | "order_received"
  | "order_status"
  | "payment_rejected"
  | "new_order_staff";

/** Subjects of these kinds contain a one-time code (the sign-in code email puts it in the subject line), so the log keeps a fixed label instead. */
const SUBJECT_REPLACED: Partial<Record<MailKind, string>> = { sign_in_code: "Sign-in code" };

/** Old rows are removed after this many days. */
export const EMAIL_LOG_KEEP_DAYS = 90;

export function subjectForLog(subject: string, kind: MailKind | null | undefined): string {
  return (kind && SUBJECT_REPLACED[kind]) || subject;
}

export class EmailLogService {
  static Instance = new EmailLogService();
  private warned = false;
  private constructor(private readonly repo = EmailLogRepository.Instance) {}

  private warnOnce(what: string, err: unknown): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(`[email-log] ${what}:`, err instanceof Error ? err.message : err);
  }

  /** Never throws. */
  async record(rows: NewEmailLog[]): Promise<void> {
    try {
      await this.repo.insert(rows);
      this.warned = false;
    } catch (err) {
      this.warnOnce("could not record emails", err);
    }
  }

  /** Called by the scheduler. Never throws. */
  async purgeOld(): Promise<number> {
    try {
      const n = await this.repo.purgeOlderThan(EMAIL_LOG_KEEP_DAYS);
      this.warned = false;
      return n;
    } catch (err) {
      this.warnOnce("could not purge old rows", err);
      return 0;
    }
  }
}
