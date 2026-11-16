// Paystack return URL: verify server-side, then send the customer to the order page.
import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { PageLoader } from "@/components/shared/PageLoader"
import { NothingSavedNotice } from "@/components/store/AccountPrompts"
import { Button } from "@/components/ui/button"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { useOrderActions } from "@/hooks/useCustomerOrders"

export default function CheckoutReturnPage() {
  const { slug } = useStore()
  const [params] = useSearchParams()
  const orderId = params.get("order")
  const navigate = useNavigate()
  const { checking, isSignedIn } = useCustomer()
  const { verifyPayment } = useOrderActions(slug)
  const [state, setState] = useState<"verifying" | "failed">("verifying")

  useEffect(() => {
    if (!orderId || checking || !isSignedIn) return
    verifyPayment.mutate(orderId, {
      onSuccess: (r) => (r.status === "paid" ? navigate(`/${slug}/orders/${orderId}`, { replace: true }) : setState("failed")),
      onError: () => setState("failed"),
    })
  }, [orderId, checking, isSignedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!orderId) return <div className="py-16 text-center"><p>Missing order reference.</p><Button asChild className="mt-4"><Link to={`/${slug}/orders`}>Your orders</Link></Button></div>
  if (checking) return <PageLoader label="Checking your account…" />
  if (!isSignedIn) return <NothingSavedNotice title="One more step" text="We need to confirm your payment, but this browser has lost the order. Contact us with your order number and we'll sort it out." cy="return-empty" />
  if (state === "verifying") return <PageLoader label="Confirming your payment…" />
  return (
    <div className="mx-auto max-w-sm py-16 text-center" data-cy="checkout-return-failed">
      <h1 className="text-2xl font-semibold">Payment not confirmed yet</h1>
      <p className="mt-2 text-muted-foreground">If you completed the payment, it may take a moment to arrive. You can retry from the order page.</p>
      <Button className="mt-4" asChild><Link to={`/${slug}/orders/${orderId}`}>Open the order</Link></Button>
    </div>
  )
}
