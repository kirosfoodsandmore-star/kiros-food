import { z } from "zod";
import { MAX_ITEM_PHOTOS } from "../../../config/constants";
import { idParams, money, optionalText, queryBool, requiredText, signedMoney, sortOrder, uuid } from "../../../shared/validation/common";

const ids = z.array(uuid).min(1).max(500);

// ── Menus ────────────────────────────────────────────────────────────────────
const menuBody = z.object({
  name: requiredText(120),
  description: optionalText(1000),
  sortOrder: sortOrder.default(0),
  isActive: z.boolean().default(true),
});
export const createMenuSchema = z.object({ body: menuBody });
export const updateMenuSchema = z.object({ params: idParams, body: menuBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update") });
export const menuIdSchema = z.object({ params: idParams });
export const reorderSchema = z.object({ body: z.object({ ids }) });

// ── Categories ───────────────────────────────────────────────────────────────
const categoryBody = z.object({
  menuId: uuid,
  name: requiredText(120),
  description: optionalText(1000),
  sortOrder: sortOrder.default(0),
});
export const listCategoriesSchema = z.object({ query: z.object({ menuId: uuid.optional() }) });
export const createCategorySchema = z.object({ body: categoryBody });
export const updateCategorySchema = z.object({ params: idParams, body: categoryBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update") });

// ── Items ────────────────────────────────────────────────────────────────────
const itemBody = z.object({
  categoryId: uuid,
  name: requiredText(160),
  description: optionalText(2000),
  basePrice: money,
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: sortOrder.default(0),
  optionGroupIds: z.array(uuid).max(30).default([]),
});
export const listItemsSchema = z.object({
  query: z.object({ menuId: uuid.optional(), categoryId: uuid.optional(), search: z.string().trim().max(120).optional(), featured: queryBool.optional() }),
});
export const itemPhotoSchema = z.object({ params: z.object({ id: uuid, photoId: uuid }) });
export const reorderPhotosSchema = z.object({ params: idParams, body: z.object({ ids: z.array(uuid).min(1).max(MAX_ITEM_PHOTOS) }) });
export const createItemSchema = z.object({ body: itemBody });
export const updateItemSchema = z.object({ params: idParams, body: itemBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update") });

// ── Option groups & options ──────────────────────────────────────────────────
const groupBody = z
  .object({
    name: requiredText(120),
    helpText: optionalText(500),
    minSelect: z.number().int().min(0).max(50).default(0),
    maxSelect: z.number().int().min(1).max(50).default(1),
    sortOrder: sortOrder.default(0),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { message: "Minimum cannot exceed maximum", path: ["minSelect"] });
export const createGroupSchema = z.object({ body: groupBody });
export const updateGroupSchema = z.object({
  params: idParams,
  body: z
    .object({ name: requiredText(120), helpText: optionalText(500), minSelect: z.number().int().min(0).max(50), maxSelect: z.number().int().min(1).max(50), sortOrder })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

const optionBody = z.object({
  name: requiredText(120),
  priceDelta: signedMoney.default(0),
  isActive: z.boolean().default(true),
  sortOrder: sortOrder.default(0),
});
export const createOptionSchema = z.object({ params: idParams, body: optionBody });
export const updateOptionSchema = z.object({
  params: z.object({ id: uuid, optionId: uuid }),
  body: optionBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});
export const optionIdSchema = z.object({ params: z.object({ id: uuid, optionId: uuid }) });

// ── Storefront ───────────────────────────────────────────────────────────────
const slugParam = z.object({ slug: z.string() });
export const storeMenusSchema = z.object({ params: slugParam.extend({ branchId: uuid }) });
export const storeMenuSchema = z.object({ params: slugParam.extend({ id: uuid }), query: z.object({ branchId: uuid }) });
export const storeItemSchema = z.object({ params: slugParam.extend({ id: uuid }), query: z.object({ branchId: uuid }) });
export const storeSearchSchema = z.object({ params: slugParam, query: z.object({ branchId: uuid, q: z.string().trim().min(1).max(80), menuId: uuid.optional() }) });
export const storeFeaturedSchema = z.object({ params: slugParam, query: z.object({ branchId: uuid }) });

export type MenuBody = z.infer<typeof menuBody>;
export type CategoryBody = z.infer<typeof categoryBody>;
export type ItemBody = z.infer<typeof itemBody>;
export type GroupBody = z.infer<typeof groupBody>;
export type UpdateGroupBody = z.infer<typeof updateGroupSchema>["body"];
export type OptionBody = z.infer<typeof optionBody>;
