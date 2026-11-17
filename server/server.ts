// Process entry: connect to the database, start HTTP + Socket.io and the background sweeps.
// Run with `npm run dev` / `npm start` (tsx) — never plain `node`.
import "reflect-metadata";
import { createApp } from "./app";
import { env } from "./config/env";
import { AppDataSource } from "./infrastructure/database/dataSource";
import { attachSocketServer, closeSocketServer } from "./infrastructure/realtime/socketServer";
import { startScheduler, stopScheduler } from "./infrastructure/scheduler/scheduler";
import { EmailNotifierService } from "./modules/notification/services/emailNotifier.service";
import { DeliveryNotifierService } from "./modules/push/services/deliveryNotifier.service";
import { emailConfigured } from "./shared/utils/mailer";

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const pending = await AppDataSource.showMigrations();
  if (pending) console.warn("[db] There are pending migrations — run `npm run migration:run`.");

  EmailNotifierService.Instance.register();
  DeliveryNotifierService.Instance.register();
  console.log(emailConfigured() ? `[mail] email on (${env.email.provider === "script" ? "Apps Script relay" : "Gmail"})` : "[mail] email off — EMAIL_* not set");
  console.log(env.firebase.configured ? "[firebase] auth + Firestore on" : "[firebase] NOT configured — staff sign-in is unavailable (passwords live only in Firebase), chat off");
  console.log(env.firebase.configured ? "[push] FCM notifications on" : "[push] FCM notifications off — Firebase service account not set");
  console.log(env.cloudinary.configured ? "[storage] Cloudinary on" : "[storage] Cloudinary not configured — uploads disabled");

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Kiros API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
  if (env.socketEnabled) {
    attachSocketServer(server);
    console.log("[socket] realtime on");
  }
  if (env.platformAdminEmails.length === 0) console.log("[platform] PLATFORM_ADMIN_EMAILS not set — the platform view is closed");
  startScheduler();

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    stopScheduler();
    void closeSocketServer();
    server.close(() => {
      AppDataSource.destroy().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start the server", err);
  process.exit(1);
});
