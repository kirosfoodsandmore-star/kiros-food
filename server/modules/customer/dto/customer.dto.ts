export interface CustomerDTO {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  isBlocked: boolean;
  blockReason: string | null;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: Date | null;
  createdAt: Date;
}

export interface AddressDTO {
  id: string;
  label: string | null;
  line: string;
  lat: number | null;
  lng: number | null;
  instructions: string | null;
  isDefault: boolean;
}

export interface CustomerSessionDTO {
  /** `guest`: checked out without signing in, so this browser's session is the only way back to the orders. */
  customer: { id: string; phone: string | null; name: string | null; email: string | null; guest: boolean };
  addresses: AddressDTO[];
}

export interface CustomerLoginResultDTO extends CustomerSessionDTO {
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}
