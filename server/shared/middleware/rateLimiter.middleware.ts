import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ApiResponse } from "../response/apiResponse";

const tooMany = (_req: Request, res: Response): void => {
  res.status(429).json(ApiResponse.error("Too many requests, please try again shortly", 429));
};

/** Mounted on /api/v1 globally. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 900,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tooMany,
});

/** Login, register, refresh, password change, invites, customer sign-in. */
export const authRateLimiter = Object.assign(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: tooMany,
  }),
  { __rateLimited: true as const }
);

/** Storefront contact form: a few messages per IP per hour, so it can't be used to flood the restaurant's inbox. */
export const contactRateLimiter = Object.assign(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    // Only delivered messages count; typos and validation errors shouldn't lock a real visitor out.
    skipFailedRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: tooMany,
  }),
  { __rateLimited: true as const }
);

/** Checkout and payment claims — per IP, generous but bounded. */
export const checkoutRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tooMany,
});
