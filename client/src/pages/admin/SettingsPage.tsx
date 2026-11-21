// Restaurant settings: brand & notifications, payments (Owner), bank accounts, ownership transfer.
import { Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { SimpleFormDialog, type FieldDef } from "@/components/admin/SimpleFormDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLoader } from "@/components/shared/PageLoader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { Field } from "@/components/ui/label"
import { CurrencySelect, TimezoneSelect } from "@/components/shared/RegionalSelects"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useAdminBranches"
import { usePaymentSettings, useRestaurantSettings, useSettingsMutations } from "@/hooks/useAdminSettings"
import { useStaffList, useStaffMutations } from "@/hooks/useStaff"
import { currencySymbolFor } from "@/lib/regional"
import type { BankAccount } from "@/types/admin.types"

export default function SettingsPage() {
  const { can } = useAuth()
  const { data: restaurant, isLoading } = useRestaurantSettings()
  if (isLoading || !restaurant) return <PageLoader />
  return (
    <div data-cy="settings-page">
      <PageHeader title="Settings" />
      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand" data-cy="tab-brand">Brand & storefront</TabsTrigger>
          {can("settings.payments") ? <TabsTrigger value="payments" data-cy="tab-payments">Payments</TabsTrigger> : null}
          {can("staff.manage") ? <TabsTrigger value="ownership" data-cy="tab-ownership">Ownership</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="brand"><BrandSettings /></TabsContent>
        {can("settings.payments") ? <TabsContent value="payments"><PaymentSettingsTab /></TabsContent> : null}
        {can("staff.manage") ? <TabsContent value="ownership"><OwnershipTab /></TabsContent> : null}
      </Tabs>
    </div>
  )
}

/** Select value for "no fixed default" (a Radix item cannot have an empty value). */
const AUTO_BRANCH = "auto"

type BrandForm = {
  name: string; slug: string; tagline: string; phone: string; email: string; address: string; currencyCode: string; currencySymbol: string; currencyDecimals: number; timezone: string; orderPrefix: string
  notifyStaffNewOrders: boolean; notifyCustomersByEmail: boolean; defaultBranchId: string; instagram: string; facebook: string; tiktok: string; whatsapp: string
}

function BrandSettings() {
  const { can } = useAuth()
  const manage = can("settings.manage")
  const { data: r } = useRestaurantSettings()
  const m = useSettingsMutations()
  const { data: branches } = useBranches()
  const [form, setForm] = useState<BrandForm | null>(null)
  useEffect(() => {
    if (r) setForm({ name: r.name, slug: r.slug, tagline: r.tagline ?? "", phone: r.phone ?? "", email: r.email ?? "", address: r.address ?? "", currencyCode: r.currencyCode, currencySymbol: r.currencySymbol, currencyDecimals: r.currencyDecimals, timezone: r.timezone, orderPrefix: r.orderPrefix, notifyStaffNewOrders: r.notifyStaffNewOrders, notifyCustomersByEmail: r.notifyCustomersByEmail, defaultBranchId: r.defaultBranchId ?? AUTO_BRANCH, instagram: r.socialLinks?.instagram ?? "", facebook: r.socialLinks?.facebook ?? "", tiktok: r.socialLinks?.tiktok ?? "", whatsapp: r.socialLinks?.whatsapp ?? "" })
  }, [r])
  // Picking a currency also fills in its usual symbol (still editable). Stable callbacks keep the big pickers from re-rendering.
  const pickCurrency = useCallback((code: string) => setForm((f) => (f ? { ...f, currencyCode: code, currencySymbol: currencySymbolFor(code) } : f)), [])
  const pickTimezone = useCallback((timezone: string) => setForm((f) => (f ? { ...f, timezone } : f)), [])
  if (!r || !form) return null
  const save = () => {
    const { instagram, facebook, tiktok, whatsapp, defaultBranchId, ...rest } = form
    m.update.mutate({ ...rest, defaultBranchId: defaultBranchId === AUTO_BRANCH ? null : defaultBranchId, tagline: rest.tagline || null, phone: rest.phone || null, email: rest.email || null, address: rest.address || null, socialLinks: { instagram: instagram || null, facebook: facebook || null, tiktok: tiktok || null, whatsapp: whatsapp || null } }, { onSuccess: () => toast.success("Settings saved"), onError: (e) => toast.error(e.message) })
  }
  const text = (k: keyof BrandForm) => ({ value: String(form[k]), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }), disabled: !manage })
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Brand</CardTitle><CardDescription>Shown on the storefront and in emails.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Restaurant name"><Input {...text("name")} data-cy="settings-name" /></Field>
          <Field label="Storefront address" hint={`Customers open /${form.slug}`}><Input {...text("slug")} data-cy="settings-slug" /></Field>
          <Field label="Tagline"><Input {...text("tagline")} /></Field>
          <Field label="Phone"><Input {...text("phone")} /></Field>
          <Field label="Contact email" hint="Replies to customer emails go here."><Input type="email" {...text("email")} /></Field>
          <Field label="Address"><Textarea {...text("address")} /></Field>
          <Field label="Branch shown to new visitors" hint="First-time visitors see this branch's menu until they choose another. If it is closed or paused, an open branch is shown instead.">
            <Select value={form.defaultBranchId} onValueChange={(v) => setForm({ ...form, defaultBranchId: v })} disabled={!manage}>
              <SelectTrigger data-cy="settings-default-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_BRANCH}>Automatic: the first open branch</SelectItem>
                {(branches ?? []).filter((b) => b.isActive).map((b) => <SelectItem key={b.id} value={b.id}>{b.name} · {b.city}{b.isPaused ? " (paused)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Currency, time & order numbers</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Currency"><CurrencySelect value={form.currencyCode} onChange={pickCurrency} disabled={!manage} dataCy="settings-currency" /></Field>
            <Field label="Symbol"><Input {...text("currencySymbol")} maxLength={8} /></Field>
            <Field label="Decimals"><Select value={String(form.currencyDecimals)} onValueChange={(v) => setForm({ ...form, currencyDecimals: Number(v) })} disabled={!manage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="2">2</SelectItem></SelectContent></Select></Field>
            <Field label="Timezone" hint="Opening hours and daily reports follow this."><TimezoneSelect value={form.timezone} onChange={pickTimezone} disabled={!manage} dataCy="settings-timezone" /></Field>
            <Field label="Order number prefix" hint="2–6 letters or digits"><Input {...text("orderPrefix")} maxLength={6} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notifications & social</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 text-sm"><Switch checked={form.notifyStaffNewOrders} disabled={!manage} onCheckedChange={(v) => setForm({ ...form, notifyStaffNewOrders: v })} /> Email branch staff when a paid order arrives</label>
            <label className="flex items-center gap-3 text-sm"><Switch checked={form.notifyCustomersByEmail} disabled={!manage} onCheckedChange={(v) => setForm({ ...form, notifyCustomersByEmail: v })} /> Email customers about their orders (when they gave an email)</label>
            <Field label="Instagram"><Input {...text("instagram")} placeholder="https://instagram.com/…" /></Field>
            <Field label="Facebook"><Input {...text("facebook")} placeholder="https://facebook.com/…" /></Field>
            <Field label="TikTok"><Input {...text("tiktok")} /></Field>
            <Field label="WhatsApp number"><Input {...text("whatsapp")} placeholder="+234…" /></Field>
          </CardContent>
        </Card>
      </div>
      {/* One save for both columns, so it sits below both rather than under the right one. */}
      {manage ? <div className="lg:col-span-2"><Button onClick={save} loading={m.update.isPending} data-cy="settings-save">Save settings</Button></div> : null}
    </div>
  )
}

const bankFields: FieldDef[] = [
  { name: "bankName", label: "Bank", type: "text", required: true },
  { name: "accountName", label: "Account name", type: "text", required: true },
  { name: "accountNumber", label: "Account number", type: "text", required: true },
  { name: "branchId", label: "Only for branch (optional)", type: "select", options: [] },
  { name: "isActive", label: "Active", type: "switch", default: true },
]

type PaymentForm = { paystackEnabled: boolean; transferEnabled: boolean; paystackPublicKey: string; paystackSecretKey: string; paystackMode: "test" | "live"; transferWindowMinutes: number; transferInstructions: string }

function PaymentSettingsTab() {
  const { can } = useAuth()
  const manage = can("settings.payments")
  const { data: p } = usePaymentSettings()
  const { data: branches } = useBranches()
  const m = useSettingsMutations()
  const [form, setForm] = useState<PaymentForm | null>(null)
  const [bankDialog, setBankDialog] = useState<{ open: boolean; account?: BankAccount }>({ open: false })
  useEffect(() => {
    if (p) setForm({ paystackEnabled: p.paystackEnabled, transferEnabled: p.transferEnabled, paystackPublicKey: p.paystackPublicKey ?? "", paystackSecretKey: "", paystackMode: p.paystackMode, transferWindowMinutes: p.transferWindowMinutes, transferInstructions: p.transferInstructions ?? "" })
  }, [p])
  if (!p || !form) return <PageLoader />
  const fields = bankFields.map((f) => (f.name === "branchId" ? { ...f, options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) } : f))
  const save = () => m.updatePayments.mutate({ ...form, paystackPublicKey: form.paystackPublicKey || null, paystackSecretKey: form.paystackSecretKey || undefined, transferInstructions: form.transferInstructions || null }, { onSuccess: () => { toast.success("Payment settings saved"); setForm({ ...form, paystackSecretKey: "" }) }, onError: (e) => toast.error(e.message) })
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Paystack</CardTitle><CardDescription>Card, bank transfer and USSD through Paystack's hosted checkout. Set the webhook URL in the Paystack dashboard to <code className="rounded bg-muted px-1">{"<api>"}/api/v1/webhooks/paystack</code>.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {!p.secretsStorageReady ? <p className="rounded-lg bg-warning/10 p-2 text-sm">The server has no APP_ENCRYPTION_KEY, so secret keys cannot be saved yet.</p> : null}
          <label className="flex items-center gap-3 text-sm"><Switch checked={form.paystackEnabled} disabled={!manage} onCheckedChange={(v) => setForm({ ...form, paystackEnabled: v })} data-cy="paystack-enabled" /> Accept Paystack payments</label>
          <Field label="Mode"><Select value={form.paystackMode} onValueChange={(v) => setForm({ ...form, paystackMode: v as "test" | "live" })} disabled={!manage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="test">Test</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent></Select></Field>
          <Field label="Public key"><Input value={form.paystackPublicKey} onChange={(e) => setForm({ ...form, paystackPublicKey: e.target.value })} disabled={!manage} placeholder="pk_…" data-cy="paystack-public" /></Field>
          <Field label="Secret key" hint={p.paystackSecretKeyLast4 ? `A key ending in ${p.paystackSecretKeyLast4} is saved. Enter a new one to replace it.` : "Never shown again after saving."}><Input type="password" value={form.paystackSecretKey} onChange={(e) => setForm({ ...form, paystackSecretKey: e.target.value })} disabled={!manage} placeholder="sk_…" autoComplete="off" data-cy="paystack-secret" /></Field>
          {manage ? <Button variant="outline" onClick={() => m.testPaystack.mutate(undefined, { onSuccess: (r) => toast.success(`Connected${r.integration ? ` to ${r.integration}` : ""} (${r.mode})`), onError: (e) => toast.error(e.message) })} loading={m.testPaystack.isPending} data-cy="paystack-test">Test connection</Button> : null}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Bank transfer</CardTitle><CardDescription>Customers see your account details and claim the transfer; staff confirm it in Payments to confirm.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 text-sm"><Switch checked={form.transferEnabled} disabled={!manage} onCheckedChange={(v) => setForm({ ...form, transferEnabled: v })} data-cy="transfer-enabled" /> Accept bank transfers</label>
            <Field label="Payment window (minutes)"><Input type="number" min={5} value={form.transferWindowMinutes} onChange={(e) => setForm({ ...form, transferWindowMinutes: Number(e.target.value) })} disabled={!manage} /></Field>
            <Field label="Instructions for customers"><Textarea value={form.transferInstructions} onChange={(e) => setForm({ ...form, transferInstructions: e.target.value })} disabled={!manage} /></Field>
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Bank accounts</p>{manage ? <Button size="sm" variant="outline" onClick={() => setBankDialog({ open: true })} data-cy="bank-new"><Plus /> Add</Button> : null}</div>
            <ul className="divide-y text-sm">
              {p.bankAccounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2" data-cy={`bank-${a.id}`}>
                  <div className="flex-1"><p className="font-medium">{a.bankName} · {a.accountNumber}</p><p className="text-muted-foreground">{a.accountName}{a.branchId ? ` · ${branches?.find((b) => b.id === a.branchId)?.name ?? "one branch"}` : ""}</p></div>
                  {!a.isActive ? <Badge variant="neutral">Off</Badge> : null}
                  {manage ? <><Button variant="ghost" size="sm" onClick={() => setBankDialog({ open: true, account: a })}>Edit</Button><Button variant="ghost" size="icon-sm" onClick={() => m.deleteBankAccount.mutate(a.id)} aria-label="Remove"><Trash2 className="text-destructive" /></Button></> : null}
                </li>
              ))}
              {p.bankAccounts.length === 0 ? <li className="py-2 text-muted-foreground">No bank accounts yet.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
      {manage ? <div className="lg:col-span-2"><Button onClick={save} loading={m.updatePayments.isPending} data-cy="payments-save">Save payment settings</Button></div> : null}
      <SimpleFormDialog open={bankDialog.open} onOpenChange={(o) => setBankDialog({ open: o })} title={bankDialog.account ? "Edit bank account" : "Add bank account"} fields={fields} initial={bankDialog.account as unknown as Record<string, unknown> | undefined} onSubmit={async (v) => { if (bankDialog.account) await m.updateBankAccount.mutateAsync({ id: bankDialog.account.id, body: v }); else await m.addBankAccount.mutateAsync(v) }} />
    </div>
  )
}

function OwnershipTab() {
  const { session, refresh } = useAuth()
  // Searched on the server, so any active staff member can be found however large the team is.
  const [search, setSearch] = useState("")
  const term = useDebouncedSearch(search)
  const { data: staff } = useStaffList({ isActive: true, limit: 100, search: term || undefined })
  const { transferOwnership } = useStaffMutations()
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>Transfer ownership</CardTitle><CardDescription>The chosen person becomes the Owner; you become a Branch manager. Confirm with your password.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <Field label="Find a staff member"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" data-cy="transfer-search" /></Field>
        <Field label="New owner"><Select value={userId} onValueChange={setUserId}><SelectTrigger data-cy="transfer-user"><SelectValue placeholder="Choose a staff member" /></SelectTrigger><SelectContent>{(staff?.data ?? []).filter((s) => s.id !== session?.user.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.roleName}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Your password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-cy="transfer-password" /></Field>
        <Button variant="destructive" disabled={!userId || !password} loading={transferOwnership.isPending} onClick={() => transferOwnership.mutate({ userId, password }, { onSuccess: () => { toast.success("Ownership transferred"); void refresh() }, onError: (e) => toast.error(e.message) })} data-cy="transfer-confirm">Transfer ownership</Button>
      </CardContent>
    </Card>
  )
}
