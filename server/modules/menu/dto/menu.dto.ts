export interface MenuDTO {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  version: number;
  isActive: boolean;
  categoryCount: number;
  itemCount: number;
  branchIds: string[];
  createdAt: Date;
}

export interface CategoryDTO {
  id: string;
  menuId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  itemCount: number;
}

export interface OptionDTO {
  id: string;
  groupId: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
}

export interface OptionGroupDTO {
  id: string;
  name: string;
  helpText: string | null;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: OptionDTO[];
  itemCount?: number;
}

export interface ItemImageDTO {
  id: string;
  url: string;
}

export interface ItemDTO {
  id: string;
  categoryId: string;
  categoryName: string;
  menuId: string;
  name: string;
  description: string | null;
  basePrice: number;
  /** The cover photo (same as `images[0]`). */
  imageUrl: string | null;
  /** Every photo in display order, cover first. */
  images: ItemImageDTO[];
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  optionGroupIds: string[];
  createdAt: Date;
}

// ── Storefront payload ───────────────────────────────────────────────────────

export interface StoreOptionDTO {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface StoreOptionGroupDTO {
  id: string;
  name: string;
  helpText: string | null;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  options: StoreOptionDTO[];
}

export interface StoreItemCardDTO {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  /** Lowest possible price when a required group has priced options ("From …"). */
  fromPrice: number;
  hasPricedVariants: boolean;
  imageUrl: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  optionGroupCount: number;
}

export interface StoreItemDTO extends StoreItemCardDTO {
  /** Photo URLs for the item page gallery, cover first (empty when the item has none). */
  images: string[];
  categoryName: string;
  menuId: string;
  menuName: string;
  optionGroups: StoreOptionGroupDTO[];
  recommendations: StoreItemCardDTO[];
}

export interface StoreCategoryDTO {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  items: StoreItemCardDTO[];
}

export interface StoreMenuDTO {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  version: number;
  branchId: string;
  categories: StoreCategoryDTO[];
}
