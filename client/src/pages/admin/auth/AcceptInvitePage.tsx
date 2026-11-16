import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { useAuth } from "@/contexts/AuthContext"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { password as passwordRule } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"
import { AuthShell } from "./LoginPage"

export default function AcceptInvitePage() {
  const token = useSearchParams()[0].get("token") ?? ""
  const navigate = useNavigate()
  const { acceptLogin } = useAuth()
  const preview = useQuery({ queryKey: ["invite", token], queryFn: async () => unwrap(await AuthEndpoints.previewInvite(token)), enabled: Boolean(token), retry: false })
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    const check = passwordRule.safeParse(password)
    if (!check.success) return setError(check.error.errors[0].message)
    setBusy(true)
    try {
      acceptLogin(unwrap(await AuthEndpoints.acceptInvite({ token, password })))
      toast.success("Welcome aboard")
      navigate("/admin", { replace: true })
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Join the team">
      {preview.isLoading ? <PageLoader /> : preview.error || !preview.data ? <ErrorState message="This invitation link is invalid or has expired." /> : (
        <div className="space-y-4" data-cy="invite-form">
          <p className="text-sm">Hi {preview.data.name}, you're joining as <span className="font-medium">{preview.data.roleName}</span> with <span className="font-medium">{preview.data.email}</span>. Choose a password to finish.</p>
          <Field label="Password" error={error ?? undefined}><PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void accept()} data-cy="invite-password" /></Field>
          <Button className="w-full" onClick={accept} loading={busy} data-cy="invite-accept">Accept invitation</Button>
        </div>
      )}
    </AuthShell>
  )
}
