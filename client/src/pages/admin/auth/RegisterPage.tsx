import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { useAuth } from "@/contexts/AuthContext"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { useSignupStatus } from "@/hooks/useSignupStatus"
import { email, password, requiredText, slug } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"
import { AuthShell } from "./LoginPage"

const schema = z.object({
  restaurantName: requiredText(160, "Restaurant name"),
  slug: slug.optional().or(z.literal("")),
  ownerName: requiredText(120, "Your name"),
  email,
  password: password.optional().or(z.literal("")),
})
type Form = z.infer<typeof schema>

export default function RegisterPage() {
  const { acceptLogin } = useAuth()
  const navigate = useNavigate()
  const state = (useLocation().state as { idToken?: string; email?: string; name?: string } | null) ?? null
  const viaGoogle = Boolean(state?.idToken)
  const signup = useSignupStatus()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: state?.email ?? "", ownerName: state?.name ?? "" } })

  const onSubmit = async (data: Form) => {
    try {
      const result = viaGoogle
        ? unwrap(await AuthEndpoints.firebase({ idToken: state!.idToken!, restaurantName: data.restaurantName, slug: data.slug || undefined }))
        : unwrap(await AuthEndpoints.register({ restaurantName: data.restaurantName, slug: data.slug || undefined, ownerName: data.ownerName, email: data.email, password: data.password || "" }))
      acceptLogin(result)
      toast.success("Welcome to Kiros")
      navigate("/admin", { replace: true })
    } catch (err) {
      toast.error((err as ApiError).message)
    }
  }

  // Once a restaurant exists the server refuses sign-ups; show that plainly instead of a form that can only fail.
  if (signup.loading) return <AuthShell title="Create your restaurant"><p className="text-sm text-muted-foreground" role="status">One moment…</p></AuthShell>
  if (!signup.open) {
    return (
      <AuthShell title="Sign-up is closed" description="This restaurant isn't taking new sign-ups. If you work here, ask the owner to invite you.">
        <Button asChild className="w-full" data-cy="register-closed-back"><Link to="/admin/login">Back to sign in</Link></Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your restaurant" description={viaGoogle ? `Signed in with Google as ${state?.email}. Name your restaurant to finish.` : "You become the Owner and can invite staff later."}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-cy="register-form">
        <Field label="Restaurant name" error={errors.restaurantName?.message}><Input {...register("restaurantName")} data-cy="register-restaurant" /></Field>
        <Field label="Storefront address (optional)" error={errors.slug?.message} hint="Letters, numbers and dashes. Appears in your storefront link."><Input placeholder="my-kitchen" {...register("slug")} data-cy="register-slug" /></Field>
        {!viaGoogle ? (
          <>
            <Field label="Your name" error={errors.ownerName?.message}><Input autoComplete="name" {...register("ownerName")} data-cy="register-name" /></Field>
            <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} data-cy="register-email" /></Field>
            <Field label="Password" error={errors.password?.message}><PasswordInput autoComplete="new-password" {...register("password")} data-cy="register-password" /></Field>
          </>
        ) : null}
        <Button type="submit" className="w-full" loading={isSubmitting} data-cy="register-submit">Create restaurant</Button>
        <p className="text-center text-sm">Already have an account? <Link to="/admin/login" className="text-primary hover:underline">Sign in</Link></p>
      </form>
    </AuthShell>
  )
}
