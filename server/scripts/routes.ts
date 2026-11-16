// npx tsx scripts/routes.ts — lists every mounted route with its access guard (no database needed).
import "reflect-metadata";
import { createApp } from "../app";
import { listRoutes } from "../shared/access/routeAudit";

const routes = listRoutes(createApp());
const unguarded = routes.filter((r) => !r.guard);
for (const r of routes) {
  const guard = r.guard ? r.guard.kind + (r.guard.codes.length ? ":" + r.guard.codes.join("|") : "") : "NONE";
  console.log(r.method.padEnd(6), r.path.padEnd(64), guard);
}
console.log(`\n${routes.length} routes, ${unguarded.length} without a guard`);
process.exit(unguarded.length > 0 ? 1 : 0);
