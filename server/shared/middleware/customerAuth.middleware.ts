// Customer authentication for the storefront. The customer token is issued by the server after
// Firebase verified the phone number (or Google account). `optionalCustomerAuth` lets guests browse
// and build a cart while attaching the customer when a valid token is present.
import type { NextFunction, Request, Response } from "express";
import { resolveCustomer } from "../../modules/customer/services/customerResolver";
import { AppError } from "../errors/AppError";
import { verifyCustomerToken } from "../utils/jwt";

async function attach(req: Request, strict: boolean): Promise<void> {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    if (strict) throw AppError.unauthorised("Sign in to continue");
    return;
  }
  let payload;
  try {
    payload = verifyCustomerToken(token);
  } catch (err) {
    if (strict) throw err;
    return;
  }
  const customer = await resolveCustomer(payload.sub, payload.org);
  if (!customer) {
    if (strict) throw AppError.unauthorised("Your account is blocked or no longer exists");
    return;
  }
  req.customer = { ...customer, ip: req.ip };
}

export async function customerAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await attach(req, true);
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await attach(req, false);
    next();
  } catch (err) {
    next(err);
  }
}
