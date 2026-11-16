import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AvailabilityEndpoints, MenuEndpoints } from "@/endpoints/admin.endpoints"
import { unwrap } from "@/transport/http"

export const MENU_KEY = "admin-menu"
export const AVAILABILITY_KEY = "admin-availability"
type Body = Record<string, unknown>

export function useMenus() {
  return useQuery({ queryKey: [MENU_KEY, "menus"], queryFn: async () => unwrap(await MenuEndpoints.menus()) })
}
export function useCategories(menuId?: string) {
  return useQuery({ queryKey: [MENU_KEY, "categories", menuId ?? "all"], queryFn: async () => unwrap(await MenuEndpoints.categories(menuId)) })
}
export function useItems(params: Body = {}) {
  return useQuery({ queryKey: [MENU_KEY, "items", params], queryFn: async () => unwrap(await MenuEndpoints.items(params)) })
}
export function useOptionGroups() {
  return useQuery({ queryKey: [MENU_KEY, "groups"], queryFn: async () => unwrap(await MenuEndpoints.groups()) })
}

export function useMenuMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: [MENU_KEY] })
  const m = <V,>(fn: (v: V) => Promise<unknown>) => useMutation({ mutationFn: fn, onSuccess: done })
  return {
    createMenu: m((b: Body) => MenuEndpoints.createMenu(b).then(unwrap)),
    updateMenu: m((v: { id: string; body: Body }) => MenuEndpoints.updateMenu(v.id, v.body).then(unwrap)),
    deleteMenu: m((id: string) => MenuEndpoints.deleteMenu(id).then(unwrap)),
    uploadMenuImage: m((v: { id: string; file: File }) => MenuEndpoints.uploadMenuImage(v.id, v.file).then(unwrap)),
    createCategory: m((b: Body) => MenuEndpoints.createCategory(b).then(unwrap)),
    updateCategory: m((v: { id: string; body: Body }) => MenuEndpoints.updateCategory(v.id, v.body).then(unwrap)),
    deleteCategory: m((id: string) => MenuEndpoints.deleteCategory(id).then(unwrap)),
    reorderCategories: m((ids: string[]) => MenuEndpoints.reorderCategories(ids).then(unwrap)),
    createItem: m((b: Body) => MenuEndpoints.createItem(b).then(unwrap)),
    updateItem: m((v: { id: string; body: Body }) => MenuEndpoints.updateItem(v.id, v.body).then(unwrap)),
    deleteItem: m((id: string) => MenuEndpoints.deleteItem(id).then(unwrap)),
    addItemPhotos: m((v: { id: string; files: File[] }) => MenuEndpoints.addItemPhotos(v.id, v.files).then(unwrap)),
    removeItemPhoto: m((v: { id: string; photoId: string }) => MenuEndpoints.removeItemPhoto(v.id, v.photoId).then(unwrap)),
    reorderItemPhotos: m((v: { id: string; ids: string[] }) => MenuEndpoints.reorderItemPhotos(v.id, v.ids).then(unwrap)),
    reorderItems: m((ids: string[]) => MenuEndpoints.reorderItems(ids).then(unwrap)),
    createGroup: m((b: Body) => MenuEndpoints.createGroup(b).then(unwrap)),
    updateGroup: m((v: { id: string; body: Body }) => MenuEndpoints.updateGroup(v.id, v.body).then(unwrap)),
    deleteGroup: m((id: string) => MenuEndpoints.deleteGroup(id).then(unwrap)),
    createOption: m((v: { groupId: string; body: Body }) => MenuEndpoints.createOption(v.groupId, v.body).then(unwrap)),
    updateOption: m((v: { groupId: string; optionId: string; body: Body }) => MenuEndpoints.updateOption(v.groupId, v.optionId, v.body).then(unwrap)),
    deleteOption: m((v: { groupId: string; optionId: string }) => MenuEndpoints.deleteOption(v.groupId, v.optionId).then(unwrap)),
  }
}

export function useAvailability(branchId?: string) {
  return useQuery({ queryKey: [AVAILABILITY_KEY, branchId ?? "all"], queryFn: async () => unwrap(await AvailabilityEndpoints.list(branchId)) })
}

export function useSetAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { branchId: string; itemId?: string; optionId?: string; isAvailable: boolean; restoreAt?: string | null }) => unwrap(await AvailabilityEndpoints.set(body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [AVAILABILITY_KEY] }),
  })
}

export function useSetManyAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { branchId: string; targets: Array<{ itemId?: string; optionId?: string }>; isAvailable: boolean; restoreAt?: string | null }) => unwrap(await AvailabilityEndpoints.setMany(body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [AVAILABILITY_KEY] }),
  })
}
