// Staff authentication: /api/v1/auth.
import { wrapCall } from "@/transport/http"
import type { LoginResult, Session } from "@/types/admin.types"

export const AuthEndpoints = {
  login: (body: { email: string; password: string }) => wrapCall<LoginResult>("POST", "/api/v1/auth/login", body),
  signupStatus: () => wrapCall<{ open: boolean }>("GET", "/api/v1/auth/signup-status"),
  register: (body: { restaurantName: string; slug?: string; ownerName: string; email: string; password: string; phone?: string | null; address?: string | null }) => wrapCall<LoginResult>("POST", "/api/v1/auth/register", body),
  firebase: (body: { idToken: string; restaurantName?: string; slug?: string }) => wrapCall<LoginResult>("POST", "/api/v1/auth/firebase", body),
  refresh: (refreshToken: string) => wrapCall<{ accessToken: string; refreshToken: string }>("POST", "/api/v1/auth/refresh", { refreshToken }),
  logout: (refreshToken: string) => wrapCall<null>("POST", "/api/v1/auth/logout", { refreshToken }),
  me: () => wrapCall<Session>("GET", "/api/v1/auth/me"),
  updateMe: (body: { name?: string; phone?: string | null }) => wrapCall<Session>("PATCH", "/api/v1/auth/me", body),
  changePassword: (body: { currentPassword: string; newPassword: string }) => wrapCall<{ accessToken: string; refreshToken: string }>("POST", "/api/v1/auth/change-password", body),
  forgotPassword: (email: string) => wrapCall<{ message: string; devCode?: string }>("POST", "/api/v1/auth/forgot-password", { email }),
  resetPassword: (body: { email: string; code: string; newPassword: string }) => wrapCall<{ message: string }>("POST", "/api/v1/auth/reset-password", body),
  previewInvite: (token: string) => wrapCall<{ email: string; name: string; roleName: string; expiresAt: string }>("GET", `/api/v1/auth/invite/${encodeURIComponent(token)}`),
  acceptInvite: (body: { token: string; password: string; name?: string; phone?: string | null }) => wrapCall<LoginResult>("POST", "/api/v1/auth/accept-invite", body),
}
