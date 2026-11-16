import type { Actor, CustomerActor } from "./actor";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Output of validate(schema): { body, query, params } after Zod parsing. */
      validated?: unknown;
      /** Set by authMiddleware (staff). */
      user?: Actor;
      /** Set by customerAuthMiddleware / optionalCustomerAuth (storefront). */
      customer?: CustomerActor;
      /** Raw request body, kept for webhook signature checks. */
      rawBody?: Buffer;
    }
  }
}

export {};
