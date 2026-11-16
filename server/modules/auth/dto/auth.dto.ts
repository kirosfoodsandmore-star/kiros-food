import type { RestaurantProfileDTO } from "../../organization/dto/organization.dto";

export interface TokenPairDTO {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface SessionUserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleKey: string;
  roleName: string;
  branchIds: string[];
  allBranches: boolean;
  /** Listed in PLATFORM_ADMIN_EMAILS — may open the cross-restaurant platform view. */
  isPlatformAdmin: boolean;
}

export interface SessionDTO {
  user: SessionUserDTO;
  permissions: readonly string[];
  restaurant: RestaurantProfileDTO;
}

export interface LoginResultDTO extends SessionDTO {
  tokens: TokenPairDTO;
}
