// Single HTTP client. All config lives here: base URL, auth headers, token refresh, error
// normalisation, multipart helpers and downloads. Endpoints call wrapCall; components never do.
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios"
import { tokenStorage, type TokenKind } from "@/lib/storage"
import type { ApiResponse, ValidationError } from "@/types/api.types"

export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000"

export class ApiError extends Error {
  statusCode: number
  errors: ValidationError[]
  data: unknown
  constructor(message: string, statusCode = 0, errors: ValidationError[] = [], data: unknown = null) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.errors = errors
    this.data = data
  }
}

export interface CallOptions {
  timeoutMs?: number
  headers?: Record<string, string>
}

/** Storefront routes use the customer token pair; everything else uses the staff pair. */
export function tokenKindFor(path: string): TokenKind {
  return path.includes("/api/v1/store/") ? "customer" : "staff"
}

/** Extract the storefront slug from a request path (for customer refresh). */
function slugFrom(path: string): string | null {
  const m = /\/api\/v1\/store\/([^/]+)/.exec(path)
  return m ? m[1] : null
}

const http = axios.create({ baseURL: BASE_URL, timeout: 20_000, headers: { "Content-Type": "application/json" } })

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const path = config.url ?? ""
  const token = tokenStorage.getAccess(tokenKindFor(path))
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  return config
})

const refreshing: Partial<Record<TokenKind, Promise<boolean>>> = {}

async function refreshTokens(kind: TokenKind, slug: string | null): Promise<boolean> {
  const refreshToken = tokenStorage.getRefresh(kind)
  if (!refreshToken) return false
  const url = kind === "customer" ? `/api/v1/store/${slug}/auth/refresh` : "/api/v1/auth/refresh"
  try {
    const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(`${BASE_URL}${url}`, { refreshToken }, { timeout: 15_000 })
    if (!res.data.success || !res.data.data) throw new Error(res.data.message)
    tokenStorage.set(kind, res.data.data.accessToken, res.data.data.refreshToken)
    return true
  } catch {
    tokenStorage.clear(kind)
    window.dispatchEvent(new CustomEvent("kiros:session-expired", { detail: { kind } }))
    return false
  }
}

function isAuthRoute(path: string): boolean {
  return /\/auth\/(login|register|firebase|google|refresh|logout|forgot-password|reset-password|accept-invite|invite)/.test(path)
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiResponse>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const path = config?.url ?? ""
    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute(path)) {
      const kind = tokenKindFor(path)
      if (kind === "customer" && !slugFrom(path)) throw error
      refreshing[kind] ??= refreshTokens(kind, slugFrom(path)).finally(() => {
        delete refreshing[kind]
      })
      const ok = await refreshing[kind]
      if (ok) {
        config._retried = true
        config.headers.Authorization = `Bearer ${tokenStorage.getAccess(kind)}`
        return http.request(config)
      }
    }
    throw error
  }
)

function normalise<T>(error: unknown): ApiResponse<T> {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiResponse<T> | undefined
    if (body && typeof body === "object" && "success" in body) return body
    if (error.code === "ECONNABORTED") return { success: false, message: "The request timed out, please try again", statusCode: 0, data: null, errors: [] }
    if (!error.response) return { success: false, message: "You appear to be offline", statusCode: 0, data: null, errors: [] }
    return { success: false, message: error.message, statusCode: error.response.status, data: null, errors: [] }
  }
  return { success: false, message: "Something went wrong", statusCode: 0, data: null, errors: [] }
}

export async function wrapCall<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, payload?: Record<string, unknown>, options: CallOptions = {}): Promise<ApiResponse<T>> {
  const config: AxiosRequestConfig = { method, url: path, timeout: options.timeoutMs ?? 20_000, headers: options.headers }
  if (method === "GET") config.params = payload
  else config.data = payload
  try {
    const res = await http.request<ApiResponse<T>>(config)
    return res.data
  } catch (err) {
    return normalise<T>(err)
  }
}

export async function uploadWithFields<T>(path: string, file: File | null, fields: Record<string, string | number | boolean | null | undefined> = {}, fileField = "file", method: "POST" | "PUT" = "POST"): Promise<ApiResponse<T>> {
  const form = new FormData()
  if (file) form.append(fileField, file)
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) form.append(k, String(v))
  try {
    const res = await http.request<ApiResponse<T>>({ method, url: path, data: form, headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 })
    return res.data
  } catch (err) {
    return normalise<T>(err)
  }
}

/** Several files under one field name (e.g. an item's photo gallery). Longer timeout: a batch of photos is big. */
export async function uploadFiles<T>(path: string, files: File[], fileField: string): Promise<ApiResponse<T>> {
  const form = new FormData()
  for (const f of files) form.append(fileField, f)
  try {
    const res = await http.request<ApiResponse<T>>({ method: "POST", url: path, data: form, headers: { "Content-Type": "multipart/form-data" }, timeout: 180_000 })
    return res.data
  } catch (err) {
    return normalise<T>(err)
  }
}

export async function downloadFile(path: string, filename: string, params?: Record<string, unknown>): Promise<void> {
  const res = await http.request<Blob>({ method: "GET", url: path, params, responseType: "blob", timeout: 60_000 })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Turn a failed envelope into a thrown ApiError (used by hooks). */
export function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new ApiError(res.message, res.statusCode, res.errors, res.data)
  return res.data as T
}
