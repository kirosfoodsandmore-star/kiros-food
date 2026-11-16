import { Router } from "express";
import { publicRoute, requireAuthenticatedOnly } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { authRateLimiter } from "../../../shared/middleware/rateLimiter.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { acceptInviteSchema, inviteTokenSchema } from "../../user/validators/user.schema";
import { AuthController } from "../controllers/auth.controller";
import {
  changePasswordSchema,
  firebaseSignInSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordWithCodeSchema,
  updateProfileSchema,
} from "../validators/auth.schema";

/** /api/v1/auth — staff (admin portal) */
const router = Router();

router.post("/login", publicRoute("staff sign-in"), authRateLimiter, validate(loginSchema), AuthController.login);
router.get("/signup-status", publicRoute("check whether restaurant sign-up is open"), AuthController.signupStatus);
router.post("/register",publicRoute("create a restaurant and its owner"), authRateLimiter, validate(registerSchema), AuthController.register);
router.post("/firebase", publicRoute("sign in with a Firebase ID token (Google / email)"), authRateLimiter, validate(firebaseSignInSchema), AuthController.firebase);
router.post("/google", publicRoute("sign in with a Google ID token"), authRateLimiter, validate(googleSignInSchema), AuthController.google);
router.post("/refresh", publicRoute("token refresh"), authRateLimiter, validate(refreshSchema), AuthController.refresh);
router.post("/logout", publicRoute("revoke refresh token"), validate(refreshSchema), AuthController.logout);
router.post("/forgot-password", publicRoute("request a password reset code"), authRateLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post("/reset-password", publicRoute("reset password with emailed code"), authRateLimiter, validate(resetPasswordWithCodeSchema), AuthController.resetPassword);
router.get("/invite/:token", publicRoute("preview a staff invitation"), validate(inviteTokenSchema), AuthController.previewInvite);
router.post("/accept-invite", publicRoute("accept a staff invitation"), authRateLimiter, validate(acceptInviteSchema), AuthController.acceptInvite);

router.get("/me", authMiddleware, requireAuthenticatedOnly(), AuthController.me);
router.patch("/me", authMiddleware, requireAuthenticatedOnly(), validate(updateProfileSchema), AuthController.updateMe);
router.post("/change-password", authMiddleware, requireAuthenticatedOnly(), authRateLimiter, validate(changePasswordSchema), AuthController.changePassword);

export default router;
