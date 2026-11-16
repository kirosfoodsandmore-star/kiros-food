import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"
import { BrandLogo } from "@/components/shared/BrandLogo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { useAuth } from "@/contexts/AuthContext"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { useSignupStatus } from "@/hooks/useSignupStatus"
import { adminHome } from "@/lib/adminHome"
import { firebaseConfigured, signInWithGoogle } from "@/lib/firebase"
import { email } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"
import type { LoginResult } from "@/types/admin.types"

const schema = z.object({ email, password: z.string().min(1, "Password is required") })
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const { acceptLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Back to the page they were sent away from; otherwise to the home that suits their role (a rider's is their deliveries).
  const from = (location.state as { from?: string } | null)?.from
  const [googleBusy, setGoogleBusy] = useState(false)
  const signup = useSignupStatus()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })
  const signedIn = (result: LoginResult) => {
    acceptLogin(result)
    navigate(from ?? adminHome(result.permissions), { replace: true })
  }

  const onSubmit = async (data: Form) => {
    try {
      signedIn(unwrap(await AuthEndpoints.login(data)))
    } catch (err) {
      toast.error((err as ApiError).message)
    }
  }

  const google = async () => {
    setGoogleBusy(true)
    try {
      const idToken = await signInWithGoogle()
      const res = await AuthEndpoints.firebase({ idToken })
      // An unknown Google account is only sent on to "Create your restaurant" while sign-up is open.
      const d = res.success ? null : (res.data as { needsRegistration?: boolean; email?: string; name?: string } | null)
      if (!res.success && res.statusCode === 404 && d?.needsRegistration) {
        navigate("/admin/register", { state: { idToken, email: d.email, name: d.name } })
        return
      }
      signedIn(unwrap(res))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <AuthShell title="Admin sign in" description="For restaurant owners and managers.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-cy="login-form">
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" autoFocus {...register("email")} data-cy="login-email" /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput autoComplete="current-password" {...register("password")} data-cy="login-password" /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting} data-cy="login-submit">Sign in</Button>
        {firebaseConfigured ? <Button type="button" variant="outline" className="w-full" onClick={google} loading={googleBusy} data-cy="login-google">Continue with Google</Button> : null}
        <div className="flex justify-between text-sm">
          <Link to="/admin/forgot-password" className="text-primary hover:underline" data-cy="login-forgot">Forgot password?</Link>
          {signup.open ? <Link to="/admin/register" className="text-primary hover:underline" data-cy="login-register">Create a restaurant</Link> : null}
        </div>
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span>Kitchen or branch staff? <Link to="/staff/login" className="font-medium text-primary hover:underline" data-cy="login-staff">Staff login</Link></span>
          <span>Delivering orders? <Link to="/rider/login" className="font-medium text-primary hover:underline" data-cy="login-rider">Rider login</Link></span>
        </p>
      </form>
    </AuthShell>
  )
}

export function AuthShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <Link to="/" className="flex items-center justify-center text-xl" aria-label="Home">
          <BrandLogo slug={import.meta.env.VITE_DEFAULT_STORE_SLUG as string | undefined} className="h-11" />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
