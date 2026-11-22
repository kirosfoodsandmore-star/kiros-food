// Entity registry. Order matters only for readability; TypeORM resolves relations by name.
import type { EntitySchema } from "typeorm";
import { RoleEntity } from "../../modules/access/entities/role.entity";
import { AuditLogEntity } from "../../modules/audit/entities/auditLog.entity";
import { PasswordResetEntity } from "../../modules/auth/entities/passwordReset.entity";
import { RefreshTokenEntity } from "../../modules/auth/entities/refreshToken.entity";
import { AvailabilityEntity } from "../../modules/availability/entities/availability.entity";
import { BranchEntity } from "../../modules/branch/entities/branch.entity";
import { BranchMenuEntity } from "../../modules/branch/entities/branchMenu.entity";
import { DeliveryZoneEntity } from "../../modules/branch/entities/deliveryZone.entity";
import { HolidayClosureEntity } from "../../modules/branch/entities/holidayClosure.entity";
import { OpeningHourEntity } from "../../modules/branch/entities/openingHour.entity";
import { CartEntity } from "../../modules/cart/entities/cart.entity";
import { CartLineEntity } from "../../modules/cart/entities/cartLine.entity";
import { ChatConversationEntity } from "../../modules/chat/entities/chatConversation.entity";
import { AddressEntity } from "../../modules/customer/entities/address.entity";
import { CustomerEntity } from "../../modules/customer/entities/customer.entity";
import { CustomerEmailCodeEntity } from "../../modules/customer/entities/customerEmailCode.entity";
import { CategoryEntity } from "../../modules/menu/entities/category.entity";
import { ItemEntity } from "../../modules/menu/entities/item.entity";
import { ItemOptionGroupEntity } from "../../modules/menu/entities/itemOptionGroup.entity";
import { MenuEntity } from "../../modules/menu/entities/menu.entity";
import { OptionEntity } from "../../modules/menu/entities/option.entity";
import { OptionGroupEntity } from "../../modules/menu/entities/optionGroup.entity";
import { OrderEntity } from "../../modules/order/entities/order.entity";
import { OrderLineEntity } from "../../modules/order/entities/orderLine.entity";
import { OrderStatusEventEntity } from "../../modules/order/entities/orderStatusEvent.entity";
import { CounterEntity } from "../../modules/organization/entities/counter.entity";
import { OrganizationEntity } from "../../modules/organization/entities/organization.entity";
import { BankAccountEntity } from "../../modules/payment/entities/bankAccount.entity";
import { PaymentEntity } from "../../modules/payment/entities/payment.entity";
import { PaymentSettingsEntity } from "../../modules/payment/entities/paymentSettings.entity";
import { FinanceBudgetEntity } from "../../modules/finance/entities/financeBudget.entity";
import { FinanceCategoryEntity } from "../../modules/finance/entities/financeCategory.entity";
import { FinanceEntryEntity } from "../../modules/finance/entities/financeEntry.entity";
import { FinanceEntryItemEntity } from "../../modules/finance/entities/financeEntryItem.entity";
import { FinanceEntryPartyEntity, FinancePartyEntity } from "../../modules/finance/entities/financeParty.entity";
import { PromoCodeEntity } from "../../modules/promo/entities/promoCode.entity";
import { StaffInviteEntity } from "../../modules/user/entities/staffInvite.entity";
import { UserEntity } from "../../modules/user/entities/user.entity";

export const ALL_ENTITIES: EntitySchema[] = [
  // Tenant, access, staff, auth, audit
  OrganizationEntity,
  CounterEntity,
  RoleEntity,
  UserEntity,
  StaffInviteEntity,
  RefreshTokenEntity,
  PasswordResetEntity,
  AuditLogEntity,
  // Branches
  BranchEntity,
  OpeningHourEntity,
  HolidayClosureEntity,
  DeliveryZoneEntity,
  BranchMenuEntity,
  // Menu tree
  MenuEntity,
  CategoryEntity,
  ItemEntity,
  OptionGroupEntity,
  OptionEntity,
  ItemOptionGroupEntity,
  AvailabilityEntity,
  // Customers, carts, promos
  CustomerEntity,
  CustomerEmailCodeEntity,
  AddressEntity,
  CartEntity,
  CartLineEntity,
  PromoCodeEntity,
  // Orders & payments
  OrderEntity,
  OrderLineEntity,
  OrderStatusEventEntity,
  PaymentSettingsEntity,
  BankAccountEntity,
  PaymentEntity,
  // Finance (the business's own books)
  FinanceEntryEntity,
  FinanceBudgetEntity,
  FinanceCategoryEntity,
  FinancePartyEntity,
  FinanceEntryPartyEntity,
  FinanceEntryItemEntity,
  // Chat
  ChatConversationEntity,
];
