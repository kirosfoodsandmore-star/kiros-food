import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SESSION_KEY } from "@/contexts/AuthContext"
import { SettingsEndpoints } from "@/endpoints/admin.endpoints"
import { unwrap } from "@/transport/http"

export const SETTINGS_KEY = "admin-settings"
type Body = Record<string, unknown>

export function useRestaurantSettings() {
  return useQuery({ queryKey: [SETTINGS_KEY, "restaurant"], queryFn: async () => unwrap(await SettingsEndpoints.get()) })
}
export function usePaymentSettings() {
  return useQuery({ queryKey: [SETTINGS_KEY, "payments"], queryFn: async () => unwrap(await SettingsEndpoints.payments()) })
}

export function useSettingsMutations() {
  const qc = useQueryClient()
  const done = () => {
    void qc.invalidateQueries({ queryKey: [SETTINGS_KEY] })
    void qc.invalidateQueries({ queryKey: SESSION_KEY })
  }
  const m = <V,>(fn: (v: V) => Promise<unknown>) => useMutation({ mutationFn: fn, onSuccess: done })
  return {
    update: m((b: Body) => SettingsEndpoints.update(b).then(unwrap)),
    uploadLogo: m((file: File) => SettingsEndpoints.uploadLogo(file).then(unwrap)),
    removeLogo: m(() => SettingsEndpoints.removeLogo().then(unwrap)),
    updatePayments: m((b: Body) => SettingsEndpoints.updatePayments(b).then(unwrap)),
    testPaystack: useMutation({ mutationFn: async () => unwrap(await SettingsEndpoints.testPaystack()) }),
    addBankAccount: m((b: Body) => SettingsEndpoints.addBankAccount(b).then(unwrap)),
    updateBankAccount: m((v: { id: string; body: Body }) => SettingsEndpoints.updateBankAccount(v.id, v.body).then(unwrap)),
    deleteBankAccount: m((id: string) => SettingsEndpoints.deleteBankAccount(id).then(unwrap)),
  }
}
