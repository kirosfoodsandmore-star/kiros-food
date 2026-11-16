import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { password as passwordRule } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"
import { AuthShell } from "./LoginPage"

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = async () => {
    setBusy(true)
    try {
      const r = unwrap(await AuthEndpoints.forgotPassword(email))
      toast.success(r.message)
      if (r.devCode) setCode(r.devCode)
      setStep("code")
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
    }
  }
  const reset = async () => {
    const check = passwordRule.safeParse(newPassword)
    if (!check.success) return setError(check.error.errors[0].message)
    setBusy(true)
    try {
      toast.success(unwrap(await AuthEndpoints.resetPassword({ email, code, newPassword })).message)
      navigate("/admin/login")
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Reset your password" description={step === "email" ? "We'll email you a 6-digit code." : `Enter the code sent to ${email}.`}>
      <div className="space-y-4" data-cy="forgot-form">
        {step === "email" ? (
          <>
            <Field label="Email" error={error ?? undefined}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void request()} data-cy="forgot-email" /></Field>
            <Button className="w-full" onClick={request} loading={busy} disabled={!email} data-cy="forgot-submit">Send code</Button>
          </>
        ) : (
          <>
            <Field label="Code"><Input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} data-cy="reset-code" /></Field>
            <Field label="New password" error={error ?? undefined}><PasswordInput autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void reset()} data-cy="reset-password" /></Field>
            <Button className="w-full" onClick={reset} loading={busy} data-cy="reset-submit">Set new password</Button>
          </>
        )}
        <p className="text-center text-sm"><Link to="/admin/login" className="text-primary hover:underline">Back to sign in</Link></p>
      </div>
    </AuthShell>
  )
}
