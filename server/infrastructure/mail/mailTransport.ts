// The only place an email actually leaves the server. EMAIL_PROVIDER picks the route:
//   nodemailer (default) — Gmail SMTP with EMAIL_USER + an app password in EMAIL_PASSWORD
//   script               — POST to a Google Apps Script web app (EMAIL_SCRIPT_URL) that calls MailApp
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";

export interface MailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface OutgoingMail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Display name shown as the sender (the restaurant name). */
  fromName: string;
  replyTo?: string | null;
  attachments?: MailAttachment[];
}

/** The routes an email can leave by. The email log records one of these for every email that was actually attempted. */
export type MailProvider = "gmail" | "apps_script";

/**
 * Thrown when sending failed. It says which provider was responsible so the email log can show it for failed emails too:
 * the one that refused the message, or, when the relay failed and Gmail was tried as a fallback, the last one tried
 * (the message then names both failures).
 */
export class MailSendError extends Error {
  constructor(
    message: string,
    readonly provider: MailProvider
  ) {
    super(message);
    this.name = "MailSendError";
  }
}

/** What became of a message handed to the transport. `sent` means the provider accepted it, not that it reached an inbox. */
export interface MailResult {
  sent: boolean;
  /** How it went out; null when nothing was sent. */
  provider: MailProvider | null;
  /** Anything worth a human knowing: why nothing was sent, or that the relay failed and Gmail took over. */
  note?: string;
}

let transporter: Transporter | null = null;

function smtp(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.email.user, pass: env.email.password },
      pool: true,
      maxConnections: 2,
    });
  }
  return transporter;
}

const quoteName = (name: string) => `"${name.replace(/["\\\r\n]/g, "")}"`;

async function viaScript(mail: OutgoingMail): Promise<void> {
  const toStr = Array.isArray(mail.to) ? mail.to.join(",") : mail.to;
  const response = await fetch(env.email.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: toStr,
      recipient: toStr,
      subject: mail.subject,
      html: mail.html,
      htmlBody: mail.html,
      text: mail.text,
      body: mail.text,
      name: mail.fromName,
      fromName: mail.fromName,
      replyTo: mail.replyTo ?? undefined,
      attachments: (mail.attachments ?? []).map((a) => ({
        fileName: a.filename,
        filename: a.filename,
        mimeType: a.contentType,
        contentType: a.contentType,
        content: a.content.toString("base64"),
      })),
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const bodyText = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`Email relay answered ${response.status}: ${bodyText.slice(0, 200)}`);
  // Apps Script returns 200 text/html when the script throws or is not deployed for "Anyone".
  if (bodyText.trim().startsWith("<!DOCTYPE html") || bodyText.includes("script.google.com/macros")) {
    throw new Error("Apps Script returned an HTML page instead of JSON (check the deployment permissions or script logs)");
  }
  try {
    const parsed = JSON.parse(bodyText) as { ok?: boolean; success?: boolean; error?: string };
    if (parsed.ok === false || parsed.success === false || parsed.error) throw new Error(`Apps Script error: ${parsed.error || bodyText}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Apps Script")) throw err;
  }
  console.info(`[mail] sent "${mail.subject}" to ${toStr} via Apps Script`);
}

async function viaSmtp(mail: OutgoingMail): Promise<void> {
  const toStr = Array.isArray(mail.to) ? mail.to.join(",") : mail.to;
  await smtp().sendMail({
    from: `${quoteName(mail.fromName)} <${env.email.fromAddress}>`,
    to: mail.to,
    replyTo: mail.replyTo ?? undefined,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
  });
  console.info(`[mail] sent "${mail.subject}" to ${toStr} via Gmail SMTP`);
}

export const mailTransport = {
  configured(): boolean {
    return env.email.enabled && env.email.configured;
  },

  /** Throws when the provider refuses the message; otherwise says what happened (for the email log). */
  async send(mail: OutgoingMail): Promise<MailResult> {
    if (!this.configured()) {
      console.info(`[mail] not configured — skipped "${mail.subject}"`);
      return { sent: false, provider: null, note: "Email is not configured on the server" };
    }
    if (env.email.provider === "script") {
      try {
        await viaScript(mail);
        return { sent: true, provider: "apps_script" };
      } catch (scriptErr) {
        const relayMessage = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
        console.error(`[mail] Apps Script relay failed (${relayMessage})`);
        if (env.email.user && env.email.password) {
          console.info(`[mail] falling back to Gmail SMTP for "${mail.subject}"`);
          try {
            await viaSmtp(mail);
          } catch (smtpErr) {
            // Both were tried; Gmail was the last one, so it is the provider recorded for the failure.
            throw new MailSendError(`Apps Script relay failed (${relayMessage}); the Gmail fallback also failed (${smtpErr instanceof Error ? smtpErr.message : smtpErr})`, "gmail");
          }
          return { sent: true, provider: "gmail", note: `Apps Script relay failed (${relayMessage}); sent through Gmail instead` };
        }
        throw new MailSendError(relayMessage, "apps_script");
      }
    }
    try {
      await viaSmtp(mail);
    } catch (err) {
      throw new MailSendError(err instanceof Error ? err.message : String(err), "gmail");
    }
    return { sent: true, provider: "gmail" };
  },
};
