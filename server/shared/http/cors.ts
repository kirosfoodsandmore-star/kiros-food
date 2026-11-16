// One origin rule for the REST API and the Socket.io server.
import { env } from "../../config/env";

/** In production only the configured web apps may call the API with credentials (no wildcard hosts). */
const productionOrigins = new Set([...env.corsOrigins, env.storefrontUrl, env.adminUrl]);

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || !env.isProduction || productionOrigins.has(origin);
}
