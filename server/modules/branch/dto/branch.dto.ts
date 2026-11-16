import type { PaymentMethod } from "../../../config/constants";

export interface OpeningHourDTO {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface HolidayClosureDTO {
  id: string;
  date: string;
  reason: string | null;
}

export interface DeliveryZoneDTO {
  id: string;
  name: string;
  maxDistanceKm: number;
  fee: number;
  minOrder: number;
  freeAboveAmount: number | null;
  extraMinutes: number;
  isActive: boolean;
}

export interface BranchDTO {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  timezone: string;
  isPaused: boolean;
  pauseReason: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  prepTimeMinutes: number;
  slotIntervalMinutes: number;
  paymentMethodOverride: PaymentMethod | null;
  isActive: boolean;
  sortOrder: number;
  menuIds: string[];
  createdAt: Date;
}

/** Storefront branch card: computed open state and optional distance. */
export interface StorefrontBranchDTO {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  timezone: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  isOpen: boolean;
  isPaused: boolean;
  closesAt: string | null;
  nextOpenAt: string | null;
  distanceKm: number | null;
  hours: OpeningHourDTO[];
  menus: Array<{ id: string; name: string; description: string | null; imageUrl: string | null }>;
}

export interface DeliveryQuoteDTO {
  deliverable: boolean;
  zoneId: string | null;
  zoneName: string | null;
  distanceKm: number;
  fee: number;
  minOrder: number;
  freeAboveAmount: number | null;
  extraMinutes: number;
  reason: string | null;
}
