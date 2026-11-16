// Mirrors the backend envelope (shared/response/apiResponse.ts).
export interface ApiResponse<T = null> {
  success: boolean
  message: string
  statusCode: number
  data: T | null
  errors: ValidationError[]
  meta?: PaginationMeta
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  nextCursor?: string
  summary?: Record<string, number>
}

export interface ValidationError {
  field: string
  message: string
}

export interface Paged<T> {
  data: T[]
  meta: PaginationMeta
}
