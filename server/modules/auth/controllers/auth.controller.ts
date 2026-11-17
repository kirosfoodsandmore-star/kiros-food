import { actorOf, clientOf, handle, input } from "../../../shared/http/handler";
import { StaffService } from "../../user/services/staff.service";
import { acceptInviteSchema, inviteTokenSchema } from "../../user/validators/user.schema";
import { AuthService } from "../services/auth.service";
import {
  changePasswordSchema,
  firebaseSignInSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordWithCodeSchema,
  setPasswordSchema,
  updateProfileSchema,
} from "../validators/auth.schema";

export class AuthController {
  static login = handle("Signed in", (req) => AuthService.Instance.login(input(req, loginSchema).body, clientOf(req)));
  static signupStatus = handle("Sign-up status fetched", () => AuthService.Instance.signupStatus());
  static register = handle("Restaurant created", (req) => AuthService.Instance.register(input(req, registerSchema).body, clientOf(req)), 201);
  static firebase = handle("Signed in", (req) => AuthService.Instance.firebaseSignIn(input(req, firebaseSignInSchema).body, clientOf(req)));
  static refresh = handle("Session refreshed", (req) => AuthService.Instance.refresh(input(req, refreshSchema).body.refreshToken, clientOf(req)));
  static logout = handle("Signed out", (req) => AuthService.Instance.logout(input(req, refreshSchema).body.refreshToken));
  static me = handle("Session fetched", (req) => AuthService.Instance.session(actorOf(req)));
  static updateMe = handle("Profile updated", (req) => AuthService.Instance.updateProfile(actorOf(req), input(req, updateProfileSchema).body));
  static forgotPassword = handle("Reset code requested", (req) => AuthService.Instance.forgotPassword(input(req, forgotPasswordSchema).body.email));
  static resetPassword = handle("Password reset", (req) => AuthService.Instance.resetPasswordWithCode(input(req, resetPasswordWithCodeSchema).body));
  static signInMethods = handle("Sign-in methods fetched", (req) => AuthService.Instance.signInMethods(actorOf(req)));
  static setPassword = handle("Password added", (req) => AuthService.Instance.setPassword(actorOf(req), input(req, setPasswordSchema).body, clientOf(req)));
  static changePassword =handle("Password changed", (req) => AuthService.Instance.changePassword(actorOf(req), input(req, changePasswordSchema).body, clientOf(req)));
  static previewInvite = handle("Invitation fetched", (req) => StaffService.Instance.previewInvite(input(req, inviteTokenSchema).params.token));
  static acceptInvite = handle("Welcome aboard", (req) => AuthService.Instance.acceptInvite(input(req, acceptInviteSchema).body, clientOf(req)), 201);
}
