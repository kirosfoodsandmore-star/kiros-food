import { useQuery } from "@tanstack/react-query"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { unwrap } from "@/transport/http"

/**
 * Whether the public "Create your restaurant" sign-up is open. The server closes it once a restaurant exists
 * (unless ALLOW_SIGNUP is on). `open` is false until the answer arrives, so the link never flashes up and vanishes.
 */
export function useSignupStatus() {
  const q = useQuery({
    queryKey: ["auth", "signup-status"],
    queryFn: async () => unwrap(await AuthEndpoints.signupStatus()).open,
    staleTime: 60_000,
    retry: false,
  })
  return { open: q.data === true, loading: q.isPending }
}
