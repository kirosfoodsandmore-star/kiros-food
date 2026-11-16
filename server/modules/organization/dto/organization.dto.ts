import type { SocialLinks } from "../entities/organization.entity";

/** What staff see in Settings and what the session carries. */
export interface RestaurantProfileDTO {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  tagline: string | null;
  socialLinks: SocialLinks | null;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  timezone: string;
  orderPrefix: string;
  notifyStaffNewOrders: boolean;
  notifyCustomersByEmail: boolean;
  defaultBranchId: string | null;
  isSuspended: boolean;
  createdAt: Date;
}

/** What the storefront sees (no internal flags). */
export interface StorefrontProfileDTO {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  socialLinks: SocialLinks | null;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  timezone: string;
  /** Branch to show first-time visitors; null lets the storefront pick an open one. */
  defaultBranchId: string | null;
}

export interface UpdateRestaurantInput {
  name?: string;
  slug?: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tagline?: string | null;
  socialLinks?: SocialLinks | null;
  currencyCode?: string;
  currencySymbol?: string;
  currencyDecimals?: number;
  timezone?: string;
  orderPrefix?: string;
  notifyStaffNewOrders?: boolean;
  notifyCustomersByEmail?: boolean;
  defaultBranchId?: string | null;
}
