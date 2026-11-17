// "My account": who you are (name, phone), how you sign in (password and/or Google) and, for riders, notifications.
// Passwords live only in Firebase. An account that signs in with Google has no password yet, so instead of asking
// for a "current password" it offers to add one after a fresh Google confirmation.
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { PushToggle } from "@/components/rider/PushToggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { firebaseConfigured, googleErrorMessage, signInWithGoogle } from "@/lib/firebase"
import { tokenStorage } from "@/lib/storage"
import { password as passwordRule, phone as phoneRule } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"

const METHODS_KEY = ["admin-sign-in-methods"]

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?"

export default function MyAccountPage() {
  const { session, refresh, canAny } = useAuth()
  const user = session?.user
  const [name, setName] = useState(user?.name ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [pw, setPw] = useState({ current: "", next: "" })
  const [busy, setBusy] = useState<"profile" | "password" | null>(null)
  const methods = useQuery({ queryKey: METHODS_KEY, queryFn: async () => unwrap(await AuthEndpoints.signInMethods()), staleTime: 60_000, retry: false })

  const dirty = name.trim() !== (user?.name ?? "") || (phone || null) !== (user?.phone ?? null)

  const saveProfile = async () => {
    if (!name.trim()) return toast.error("Your name is required")
    if (phone) {
      const check = phoneRule.safeParse(phone)
      if (!check.success) return toast.error(check.error.errors[0].message)
    }
    setBusy("profile")
    try {
      unwrap(await AuthEndpoints.updateMe({ name: name.trim(), phone: phone || null }))
      await refresh()
      toast.success("Profile saved")
    } catch (e) {
      toast.error((e as ApiError).message)
    } finally {
      setBusy(null)
    }
  }

  const keepNewSession = (tokens: { accessToken: string; refreshToken: string }) => {
    tokenStorage.set("staff", tokens.accessToken, tokens.refreshToken)
    setPw({ current: "", next: "" })
    void methods.refetch()
  }

  const changePassword = async () => {
    const check = passwordRule.safeParse(pw.next)
    if (!check.success) return toast.error(check.error.errors[0].message)
    setBusy("password")
    try {
      keepNewSession(unwrap(await AuthEndpoints.changePassword({ currentPassword: pw.current, newPassword: pw.next })))
      toast.success("Password changed")
    } catch (e) {
      toast.error((e as ApiError).message)
    } finally {
      setBusy(null)
    }
  }

  // Google sign-in has no password to confirm, so confirm with Google again, then add one.
  const addPassword = async () => {
    const check = passwordRule.safeParse(pw.next)
    if (!check.success) return toast.error(check.error.errors[0].message)
    setBusy("password")
    try {
      const idToken = await signInWithGoogle()
      keepNewSession(unwrap(await AuthEndpoints.setPassword({ idToken, newPassword: pw.next })))
      toast.success("Password added. You can now sign in with your email and password too.")
    } catch (e) {
      const message = e instanceof ApiError ? e.message : googleErrorMessage(e)
      if (message) toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  const hasPassword = methods.data?.password ?? true // until we know, show the usual form
  const branchCount = user?.branchIds.length ?? 0

  return (
    <div className="max-w-4xl space-y-4" data-cy="my-account-page">
      <PageHeader title="My account" />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-xl font-semibold text-primary" aria-hidden>{initials(user?.name ?? "")}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{user?.name}</p>
            <p className="break-all text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{user?.roleName}</Badge>
            <Badge variant="outline">{user?.allBranches ? "All branches" : `${branchCount} ${branchCount === 1 ? "branch" : "branches"}`}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Your team sees this name and number.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void saveProfile() }}>
              <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} data-cy="me-name" /></Field>
              <Field label="Phone" hint="Optional."><PhoneInput value={phone} onChange={setPhone} data-cy="me-phone" /></Field>
              <Field label="Email" hint="This is how you sign in, so it can't be changed here."><Input value={user?.email ?? ""} disabled readOnly data-cy="me-email" /></Field>
              <Button type="submit" disabled={!dirty} loading={busy === "profile"} data-cy="me-save">Save changes</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sign-in &amp; security</CardTitle><CardDescription>How you sign in to this account.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {methods.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /></div>
            ) : methods.data ? (
              <ul className="space-y-2 text-sm" data-cy="me-methods">
                <li className="flex items-center justify-between gap-3"><span>Google</span><Badge variant={methods.data.google ? "success" : "neutral"}>{methods.data.google ? "Connected" : "Not used"}</Badge></li>
                <li className="flex items-center justify-between gap-3"><span>Email and password</span><Badge variant={methods.data.password ? "success" : "neutral"}>{methods.data.password ? "Set" : "Not set"}</Badge></li>
              </ul>
            ) : null}

            {hasPassword ? (
              <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault(); void changePassword() }}>
                <p className="text-sm font-medium">Change password</p>
                <Field label="Current password"><PasswordInput value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" data-cy="me-current" /></Field>
                <Field label="New password" hint="8–72 characters with a letter and a number"><PasswordInput value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" data-cy="me-next" /></Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="outline" loading={busy === "password"} disabled={!pw.current || !pw.next} data-cy="me-change-password">Change password</Button>
                  <Link to="/admin/forgot-password" className="text-sm text-primary hover:underline">Forgot your current password?</Link>
                </div>
              </form>
            ) : (
              <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault(); void addPassword() }} data-cy="me-add-password">
                <p className="text-sm font-medium">Add a password</p>
                <p className="text-sm text-muted-foreground">You sign in with Google, so there's no password yet. Add one to also sign in with your email. Google will ask you to confirm it's you first.</p>
                {firebaseConfigured ? (
                  <>
                    <Field label="New password" hint="8–72 characters with a letter and a number"><PasswordInput value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" data-cy="me-new-password" /></Field>
                    <Button type="submit" variant="outline" loading={busy === "password"} disabled={!pw.next} data-cy="me-add-password-btn">Confirm with Google and add password</Button>
                  </>
                ) : (
                  <Link to="/admin/forgot-password" className="text-sm text-primary hover:underline">Use “Forgot password” to add one</Link>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {canAny("orders.deliver", "orders.assign_rider") ? (
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent><PushToggle /></CardContent>
        </Card>
      ) : null}
    </div>
  )
}
