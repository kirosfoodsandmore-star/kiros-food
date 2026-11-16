// Server-side carts. Every call returns the fully repriced cart with line warnings, delivery quote,
// promo result and the list of checkout blockers. The anonymous token (X-Cart-Token) identifies the
// cart; the client stores it in the browser.
import { CART_TTL_DAYS } from "../../../config/constants";
import { AppError } from "../../../shared/errors/AppError";
import type { CustomerActor } from "../../../shared/types/actor";
import { hashToken, randomToken } from "../../../shared/utils/jwt";
import { BranchService } from "../../branch/services/branch.service";
import { StorefrontMenuService } from "../../menu/services/storefrontMenu.service";
import { PromoService } from "../../promo/services/promo.service";
import { priceLines, sameLine, type LineInput } from "../domain/pricing";
import type { CartDTO } from "../dto/cart.dto";
import type { Cart } from "../entities/cart.entity";
import { CartRepository } from "../repositories/cart.repository";
import type { AddLineInput, CreateCartInput, UpdateCartInput, UpdateLineInput } from "../validators/cart.schema";

const ttl = () => new Date(Date.now() + CART_TTL_DAYS * 86_400_000);

export class CartService {
  static Instance = new CartService();
  private constructor(
    private readonly carts = CartRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly menus = StorefrontMenuService.Instance,
    private readonly promos = PromoService.Instance
  ) {}

  /** Loads a cart by token and checks it belongs to the restaurant and (when signed in) the customer. */
  async load(organizationId: string, id: string, token: string, customer?: CustomerActor | null): Promise<Cart> {
    const cart = await this.carts.findByTokenHash(organizationId, hashToken(token));
    if (!cart || cart.id !== id) throw AppError.notFound("Cart not found");
    if (cart.customerId && customer && cart.customerId !== customer.id) throw AppError.forbidden("This cart belongs to another account");
    if (cart.expiresAt.getTime() < Date.now()) throw AppError.notFound("Your cart has expired");
    return cart;
  }

  async create(organizationId: string, data: CreateCartInput, customer?: CustomerActor | null): Promise<CartDTO> {
    const { branch } = await this.branches.loadForOrdering(organizationId, data.branchId);
    const menuId = data.menuId ?? branch.menuIds[0] ?? null;
    const token = randomToken(32);
    const cart = await this.carts.create({
      organizationId,
      branchId: branch.id,
      menuId,
      tokenHash: hashToken(token),
      customerId: customer?.id ?? null,
      fulfilment: data.fulfilment,
      scheduledFor: null,
      promoCode: null,
      deliveryAddress: null,
      phone: customer?.phone || null,
      expiresAt: ttl(),
    });
    return { ...(await this.view(cart, customer)), token };
  }

  async get(organizationId: string, id: string, token: string, customer?: CustomerActor | null): Promise<CartDTO> {
    return this.view(await this.load(organizationId, id, token, customer), customer);
  }

  async update(organizationId: string, id: string, token: string, data: UpdateCartInput, customer?: CustomerActor | null): Promise<CartDTO> {
    const cart = await this.load(organizationId, id, token, customer);
    if (data.menuId && !(await this.menus.menusForBranch(organizationId, cart.branchId)).some((m) => m.id === data.menuId)) throw AppError.badRequest("This branch does not serve that menu");
    await this.carts.update(cart.id, {
      ...(data.fulfilment !== undefined ? { fulfilment: data.fulfilment } : {}),
      ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null } : {}),
      ...(data.deliveryAddress !== undefined ? { deliveryAddress: data.deliveryAddress ? { ...data.deliveryAddress, lat: data.deliveryAddress.lat ?? null, lng: data.deliveryAddress.lng ?? null } : null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.menuId !== undefined ? { menuId: data.menuId } : {}),
      ...(customer && !cart.customerId ? { customerId: customer.id } : {}),
      expiresAt: ttl(),
    });
    return this.view((await this.carts.findById(organizationId, cart.id))!, customer);
  }

  async addLine(organizationId: string, id: string, token: string, data: AddLineInput, customer?: CustomerActor | null): Promise<CartDTO> {
    const cart = await this.load(organizationId, id, token, customer);
    const lines = await this.carts.lines(cart.id);
    if (lines.length >= 50) throw AppError.badRequest("Your bag is full");
    const input = { itemId: data.itemId, note: data.note ?? null, selectedOptionIds: data.selectedOptionIds };
    // Validate the item now so a bad option set is refused immediately (not just warned about).
    const catalog = await this.menus.itemsForPricing(organizationId, cart.branchId, [data.itemId]);
    const [priced] = priceLines([{ id: "new", quantity: data.quantity, ...input }], catalog).lines;
    const hard = priced.warnings.find((w) => w.code === "item_unavailable" || w.code === "option_invalid" || w.code === "group_rule");
    if (hard) throw AppError.unprocessable(hard.message);
    const sold = priced.warnings.find((w) => w.code === "item_sold_out" || w.code === "option_sold_out");
    if (sold) throw AppError.unprocessable(sold.message);
    const existing = lines.find((l) => sameLine(l, input));
    if (existing) await this.carts.updateLine(cart.id, existing.id, { quantity: Math.min(999, existing.quantity + data.quantity) });
    else await this.carts.addLine({ cartId: cart.id, itemId: data.itemId, quantity: data.quantity, note: input.note, selectedOptionIds: data.selectedOptionIds });
    await this.carts.update(cart.id, { expiresAt: ttl(), ...(customer && !cart.customerId ? { customerId: customer.id } : {}) });
    return this.view(cart, customer);
  }

  async updateLine(organizationId: string, id: string, token: string, lineId: string, data: UpdateLineInput, customer?: CustomerActor | null): Promise<CartDTO> {
    const cart = await this.load(organizationId, id, token, customer);
    const line = (await this.carts.lines(cart.id)).find((l) => l.id === lineId);
    if (!line) throw AppError.notFound("Line not found");
    await this.carts.updateLine(cart.id, lineId, {
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.selectedOptionIds !== undefined ? { selectedOptionIds: data.selectedOptionIds } : {}),
    });
    await this.carts.update(cart.id, { expiresAt: ttl() });
    return this.view(cart, customer);
  }

  async removeLine(organizationId: string, id: string, token: string, lineId: string, customer?: CustomerActor | null): Promise<CartDTO> {
    const cart = await this.load(organizationId, id, token, customer);
    await this.carts.removeLine(cart.id, lineId);
    return this.view(cart, customer);
  }

  async clear(organizationId: string, id: string, token: string, customer?: CustomerActor | null): Promise<CartDTO> {
    const cart = await this.load(organizationId, id, token, customer);
    await this.carts.clearLines(cart.id);
    await this.carts.update(cart.id, { promoCode: null });
    return this.view((await this.carts.findById(organizationId, cart.id))!, customer);
  }

  async applyPromo(organizationId: string, id: string, token: string, code: string | null, customer?: CustomerActor | null): Promise<CartDTO> {
    const cart = await this.load(organizationId, id, token, customer);
    if (code) {
      const view = await this.view(cart, customer);
      const result = await this.promos.evaluate(organizationId, code, { subtotal: view.subtotal, branchId: cart.branchId, menuId: cart.menuId, customerId: customer?.id ?? cart.customerId });
      if (!result.ok) throw AppError.unprocessable(result.reason);
    }
    await this.carts.update(cart.id, { promoCode: code ? code.toUpperCase() : null });
    return this.view((await this.carts.findById(organizationId, cart.id))!, customer);
  }

  /** Keep the lines, move to another branch, revalidate everything against its menu. */
  async switchBranch(organizationId: string, id: string, token: string, branchId: string, menuId: string | null | undefined, customer?: CustomerActor | null): Promise<CartDTO> {
    const cart = await this.load(organizationId, id, token, customer);
    const { branch } = await this.branches.loadForOrdering(organizationId, branchId);
    const nextMenu = menuId ?? (cart.menuId && branch.menuIds.includes(cart.menuId) ? cart.menuId : (branch.menuIds[0] ?? null));
    await this.carts.update(cart.id, { branchId, menuId: nextMenu, scheduledFor: null, expiresAt: ttl() });
    return this.view((await this.carts.findById(organizationId, cart.id))!, customer);
  }

  /** The full, repriced view. Also used by checkout to decide if the cart is orderable. */
  async view(cart: Cart, customer?: CustomerActor | null): Promise<CartDTO> {
    const [lines, { branch, state }] = await Promise.all([this.carts.lines(cart.id), this.branches.loadForOrdering(cart.organizationId, cart.branchId)]);
    const inputs: LineInput[] = lines.map((l) => ({ id: l.id, itemId: l.itemId, quantity: l.quantity, note: l.note, selectedOptionIds: l.selectedOptionIds }));
    const catalog = await this.menus.itemsForPricing(cart.organizationId, cart.branchId, [...new Set(inputs.map((l) => l.itemId))]);
    const priced = priceLines(inputs, catalog);
    const blockers: string[] = [];
    if (priced.lines.length === 0) blockers.push("Your bag is empty");
    if (priced.warnings.length > 0) blockers.push("Some items need attention");

    let delivery = null;
    let deliveryFee = 0;
    if (cart.fulfilment === "delivery") {
      if (!branch.deliveryEnabled) blockers.push("This branch does not deliver — choose pickup");
      if (cart.deliveryAddress?.lat != null && cart.deliveryAddress.lng != null) {
        delivery = await this.branches.deliveryQuote(cart.organizationId, cart.branchId, cart.deliveryAddress.lat, cart.deliveryAddress.lng, priced.subtotal);
        if (!delivery.deliverable) blockers.push(delivery.reason ?? "We cannot deliver to this address");
        else {
          deliveryFee = delivery.fee;
          if (priced.subtotal < delivery.minOrder) blockers.push(`Minimum order for delivery here is ${delivery.minOrder}`);
        }
      } else if (cart.deliveryAddress) blockers.push("Pin your delivery address on the map");
      else blockers.push("Add a delivery address");
    } else if (!branch.pickupEnabled) blockers.push("This branch does not offer pickup — choose delivery");

    if (!cart.phone && !customer?.phone) blockers.push("Add your phone number");
    if (branch.isPaused) blockers.push(branch.pauseReason ? `Ordering is paused: ${branch.pauseReason}` : "Ordering is paused at this branch right now");
    if (cart.scheduledFor) {
      const valid = await this.branches.isValidSlot(cart.organizationId, cart.branchId, cart.scheduledFor, delivery?.extraMinutes ?? 0);
      if (!valid) blockers.push("Choose a valid time slot");
    } else if (!state.isOpen) blockers.push("The branch is closed right now — choose a time");

    let discount = 0;
    let promo: CartDTO["promo"] = { applied: false, reason: null };
    if (cart.promoCode) {
      const result = await this.promos.evaluate(cart.organizationId, cart.promoCode, { subtotal: priced.subtotal, branchId: cart.branchId, menuId: cart.menuId, customerId: customer?.id ?? cart.customerId });
      if (result.ok) {
        discount = result.discount;
        promo = { applied: true, reason: null };
      } else {
        promo = { applied: false, reason: result.reason };
        blockers.push(`Promo code: ${result.reason}`);
      }
    }
    const total = Math.max(0, priced.subtotal + deliveryFee - discount);
    return {
      id: cart.id,
      branchId: cart.branchId,
      branchName: branch.name,
      menuId: cart.menuId,
      fulfilment: cart.fulfilment,
      scheduledFor: cart.scheduledFor?.toISOString() ?? null,
      promoCode: cart.promoCode,
      deliveryAddress: cart.deliveryAddress,
      phone: cart.phone ?? customer?.phone ?? null,
      lines: priced.lines,
      itemCount: priced.lines.reduce((n, l) => n + l.quantity, 0),
      warnings: priced.warnings,
      subtotal: priced.subtotal,
      deliveryFee,
      discount,
      total,
      promo,
      delivery,
      branch: { isOpen: state.isOpen, isPaused: state.isPaused, nextOpenAt: state.nextOpenAt?.toISOString() ?? null, deliveryEnabled: branch.deliveryEnabled, pickupEnabled: branch.pickupEnabled },
      blockers,
      expiresAt: cart.expiresAt.toISOString(),
    };
  }

  /** Reorder: a fresh cart with the lines of a past order (unavailable items become warnings). */
  async createFromLines(organizationId: string, branchId: string, menuId: string | null, fulfilment: "delivery" | "pickup", lines: LineInput[], customer: CustomerActor): Promise<CartDTO> {
    const token = randomToken(32);
    const cart = await this.carts.create({
      organizationId,
      branchId,
      menuId,
      tokenHash: hashToken(token),
      customerId: customer.id,
      fulfilment,
      scheduledFor: null,
      promoCode: null,
      deliveryAddress: null,
      phone: customer.phone || null,
      expiresAt: ttl(),
    });
    for (const l of lines) await this.carts.addLine({ cartId: cart.id, itemId: l.itemId, quantity: l.quantity, note: l.note, selectedOptionIds: l.selectedOptionIds });
    return { ...(await this.view(cart, customer)), token };
  }

  async discard(cartId: string): Promise<void> {
    await this.carts.delete(cartId);
  }

  purgeExpired(): Promise<number> {
    return this.carts.purgeExpired();
  }
}
