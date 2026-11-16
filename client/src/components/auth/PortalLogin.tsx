// One sign-in form for the team's separate doors (Staff, Rider). Each door says which accounts belong there and where
// they land. An account that's right but at the wrong door isn't signed in: it's told, plainly, which door to use.
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { useAuth } from "@/contexts/AuthContext"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { email } from "@/lib/validation"
import { AuthShell } from "@/pages/admin/auth/LoginPage"
import { ApiError, unwrap } from "@/transport/http"

const schema = z.object({ email, password: z.string().min(1, "Password is required") })
type Form = z.infer<typeof schema>

interface Props {
  title: string
  description: string
  /** Does this account belong at this door? */
  accepts: (permissions: readonly string[]) => boolean
  /** Shown when the password is right but the account belongs at another door. */
  wrongDoor: ReactNode
  /** Where this account goes after signing in (unless they were sent here from a page of theirs). */
  landing: (permissions: readonly string[]) => string
  /** Pages under this path may be returned to after signing in. */
  returnPrefix: string
  /** The other doors, for the row under the form. */
  otherDoors: Array<{ label: string; to: string }>
  /** Prefix for data-cy hooks, e.g. "rider" -> rider-login-email. */
  cy: string
}

export function PortalLogin({ title, description, accepts, wrongDoor, landing, returnPrefix, otherDoors, cy }: Props) {
  const { acceptLogin, isAuthenticated, permissions } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const sentFrom = (location.state as { from?: string } | null)?.from
  const [wrong, setWrong] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  // Already signed in with an account that belongs here: straight in.
  if (isAuthenticated && accepts(permissions)) return <Navigate to={landing(permissions)} replace />

  const onSubmit = async (data: Form) => {
    setWrong(false)
    try {
      const result = unwrap(await AuthEndpoints.login(data))
      // Right password, wrong door: don't keep the session, say where to go instead.
      if (!accepts(result.permissions)) {
        setWrong(true)
        return
      }
      acceptLogin(result)
      navigate(sentFrom?.startsWith(returnPrefix) ? sentFrom : landing(result.permissions), { replace: true })
    } catch (err) {
      toast.error((err as ApiError).message)
    }
  }

  return (
    <AuthShell title={title} description={description}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-cy={`${cy}-login-form`}>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" autoFocus {...register("email")} data-cy={`${cy}-login-email`} /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput autoComplete="current-password" {...register("password")} data-cy={`${cy}-login-password`} /></Field>
        {wrong ? <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning" role="alert" data-cy={`${cy}-login-wrong`}>{wrongDoor}</p> : null}
        <Button type="submit" className="w-full" loading={isSubmitting} data-cy={`${cy}-login-submit`}>Sign in</Button>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
          <Link to="/admin/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
          <span className="flex gap-3">
            {otherDoors.map((d) => <Link key={d.to} to={d.to} className="text-primary hover:underline" data-cy={`${cy}-login-to-${d.to.split("/")[1]}`}>{d.label}</Link>)}
          </span>
        </div>
      </form>
    </AuthShell>
  )
}
