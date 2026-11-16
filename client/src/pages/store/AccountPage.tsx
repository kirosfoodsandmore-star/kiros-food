import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut, MapPin, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { NothingSavedNotice } from "@/components/store/AccountPrompts"
import { PageLoader } from "@/components/shared/PageLoader"
import { AddressPicker } from "@/components/store/AddressPicker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { CUSTOMER_KEY, useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { unwrap } from "@/transport/http"
import type { DeliveryAddress } from "@/types/store.types"

export default function AccountPage() {
  const { slug } = useStore()
  const { session, checking, isSignedIn, signOut } = useCustomer()
  const qc = useQueryClient()
  const [name, setName] = useState(session?.customer.name ?? "")
  const [email, setEmail] = useState(session?.customer.email ?? "")
  // On a fresh load the session arrives after the first render. Seed the form once per signed-in customer
  // (not on every refetch, which would overwrite edits) — otherwise the fields stay blank and Save would
  // send email: null and wipe the stored address.
  const [seededFor, setSeededFor] = useState<string | null>(session?.customer.id ?? null)
  if (session && seededFor !== session.customer.id) {
    setSeededFor(session.customer.id)
    setName(session.customer.name ?? "")
    setEmail(session.customer.email ?? "")
  }
  const [addrOpen, setAddrOpen] = useState(false)
  const [addr, setAddr] = useState<DeliveryAddress | null>(null)
  const [label, setLabel] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: [CUSTOMER_KEY, slug] })

  const save = useMutation({ mutationFn: async () => unwrap(await StoreEndpoints.updateMe(slug, { name: name || undefined, email: email || null })), onSuccess: () => { toast.success("Saved"); void refresh() }, onError: (e) => toast.error(e.message) })
  const addAddress = useMutation({
    mutationFn: async () => unwrap(await StoreEndpoints.addAddress(slug, { label: label || null, line: addr?.line, lat: addr?.lat ?? null, lng: addr?.lng ?? null, instructions: addr?.instructions || null })),
    onSuccess: () => { toast.success("Address saved"); setAddrOpen(false); setAddr(null); setLabel(""); void refresh() },
    onError: (e) => toast.error(e.message),
  })
  const removeAddress = useMutation({ mutationFn: async (id: string) => unwrap(await StoreEndpoints.deleteAddress(slug, id)), onSuccess: () => { setDeleteId(null); void refresh() } })

  if (checking) return <PageLoader label="Checking your account…" />
  if (!isSignedIn || !session) {
    return <NothingSavedNotice title="Your account" text="Nothing is saved on this device yet. When you place an order, your details and addresses are kept here for next time." cy="account-empty" />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6" data-cy="account-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your account</h1>
        <Button variant="outline" onClick={() => (session.customer.guest ? setLeaveOpen(true) : void signOut())} data-cy="account-signout"><LogOut /> {session.customer.guest ? "Clear my details" : "Sign out"}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Phone"><Input value={session.customer.phone ?? "—"} readOnly disabled /></Field>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} data-cy="account-name" /></Field>
          <Field label="Email (for receipts)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-cy="account-email" /></Field>
          <Button onClick={() => save.mutate()} loading={save.isPending} data-cy="account-save">Save</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Saved addresses</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAddrOpen(true)} data-cy="address-add"><Plus /> Add</Button>
        </CardHeader>
        <CardContent>
          {session.addresses.length === 0 ? <p className="text-sm text-muted-foreground">No saved addresses yet.</p> : (
            <ul className="divide-y">
              {session.addresses.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-3" data-cy={`address-${a.id}`}>
                  <MapPin className="mt-0.5 size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.label ?? "Address"}{a.isDefault ? <span className="ml-2 text-xs text-muted-foreground">Default</span> : null}</p>
                    <p className="text-sm text-muted-foreground">{a.line}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(a.id)} aria-label="Remove address" data-cy="address-remove"><Trash2 className="text-destructive" /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog open={addrOpen} onOpenChange={setAddrOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add an address</DialogTitle></DialogHeader>
          <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, Office…" data-cy="address-label" /></Field>
          <AddressPicker value={addr} onChange={setAddr} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddrOpen(false)}>Cancel</Button>
            <Button onClick={() => addAddress.mutate()} disabled={!addr?.line} loading={addAddress.isPending} data-cy="address-save">Save address</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Clear your details from this device?"
        description="You're ordering as a guest, so this device is the only way back to your orders. If you clear it you won't be able to open them again. Create an account first if you want to keep them."
        confirmLabel="Clear my details"
        onConfirm={async () => {
          await signOut()
          setLeaveOpen(false)
        }}
      />
      <ConfirmDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)} title="Remove this address?" confirmLabel="Remove" loading={removeAddress.isPending} onConfirm={() => { if (deleteId) removeAddress.mutate(deleteId) }} />
    </div>
  )
}
