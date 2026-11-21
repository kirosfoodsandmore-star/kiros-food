import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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

/**
 * Chat attachments: a handful per minute per person, so a signed-in account can't fill the file storage. Only
 * multipart requests (the ones that carry a file) count; plain text messages fall under the general limit. It runs
 * before the upload is read, so a flood is turned away without being downloaded. Mistakes (a wrong file type) don't count.
 */
export const chatUploadRateLimiter = Object.assign(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 6,
    skip: (req) => !String(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/form-data"),
    skipFailedRequests: true,
    keyGenerator: (req) => `chat-upload:${req.customer?.id ?? req.user?.id ?? ipKeyGenerator(req.ip ?? "")}`,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req: Request, res: Response): void => {
      res.status(429).json(ApiResponse.error("You're sending files too quickly. Please wait a minute and try again.", 429));
    },
  }),
  { __rateLimited: true as const }
);
