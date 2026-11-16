import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { PushToggle } from "@/components/rider/PushToggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { tokenStorage } from "@/lib/storage"
import { password as passwordRule } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"

export default function MyAccountPage() {
  const { session, refresh, canAny } = useAuth()
  const [name, setName] = useState(session?.user.name ?? "")
  const [phone, setPhone] = useState(session?.user.phone ?? "")
  const [pw, setPw] = useState({ current: "", next: "" })
  const [busy, setBusy] = useState<"profile" | "password" | null>(null)

  const saveProfile = async () => {
    setBusy("profile")
    try { unwrap(await AuthEndpoints.updateMe({ name, phone: phone || null })); await refresh(); toast.success("Profile saved") } catch (e) { toast.error((e as ApiError).message) } finally { setBusy(null) }
  }
  const changePassword = async () => {
    const check = passwordRule.safeParse(pw.next)
    if (!check.success) return toast.error(check.error.errors[0].message)
    setBusy("password")
    try {
      const tokens = unwrap(await AuthEndpoints.changePassword({ currentPassword: pw.current, newPassword: pw.next }))
      tokenStorage.set("staff", tokens.accessToken, tokens.refreshToken)
      setPw({ current: "", next: "" })
      toast.success("Password changed")
    } catch (e) { toast.error((e as ApiError).message) } finally { setBusy(null) }
  }

  return (
    <div className="max-w-lg space-y-4" data-cy="my-account-page">
      <PageHeader title="My account" description={`${session?.user.email} · ${session?.user.roleName}`} />
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} data-cy="me-name" /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" data-cy="me-phone" /></Field>
          <Button onClick={saveProfile} loading={busy === "profile"} data-cy="me-save">Save</Button>
        </CardContent>
      </Card>
      {canAny("orders.deliver", "orders.assign_rider") ? (
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent><PushToggle /></CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Current password"><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" data-cy="me-current" /></Field>
          <Field label="New password" hint="8–72 characters with a letter and a number"><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" data-cy="me-next" /></Field>
          <Button variant="outline" onClick={changePassword} loading={busy === "password"} disabled={!pw.current || !pw.next} data-cy="me-change-password">Change password</Button>
        </CardContent>
      </Card>
    </div>
  )
}
