import type { Request } from "express";
import { cartTokenOf, handle, input } from "../../../shared/http/handler";
import { OrganizationService } from "../../organization/services/organization.service";
import { CartService } from "../services/cart.service";
import { addLineSchema, cartParamsSchema, createCartSchema, lineParamsSchema, promoSchema, switchBranchSchema, updateCartSchema, updateLineSchema } from "../validators/cart.schema";

const svc = () => CartService.Instance;
const org = async (req: Request) => (await OrganizationService.Instance.resolveStore((req.params as { slug: string }).slug)).id;
const customer = (req: Request) => req.customer ?? null;

export class CartController {
  static create = handle("Cart created", async (req) => svc().create(await org(req), input(req, createCartSchema).body, customer(req)), 201);
  static get = handle("Cart fetched", async (req) => svc().get(await org(req), input(req, cartParamsSchema).params.id, cartTokenOf(req), customer(req)));
  static update = handle("Cart updated", async (req) => {
    const { params, body } = input(req, updateCartSchema);
    return svc().update(await org(req), params.id, cartTokenOf(req), body, customer(req));
  });
  static addLine = handle("Added to bag", async (req) => {
    const { params, body } = input(req, addLineSchema);
    return svc().addLine(await org(req), params.id, cartTokenOf(req), body, customer(req));
  });
  static updateLine = handle("Bag updated", async (req) => {
    const { params, body } = input(req, updateLineSchema);
    return svc().updateLine(await org(req), params.id, cartTokenOf(req), params.lineId, body, customer(req));
  });
  static removeLine = handle("Removed from bag", async (req) => {
    const { params } = input(req, lineParamsSchema);
    return svc().removeLine(await org(req), params.id, cartTokenOf(req), params.lineId, customer(req));
  });
  static clear = handle("Bag cleared", async (req) => svc().clear(await org(req), input(req, cartParamsSchema).params.id, cartTokenOf(req), customer(req)));
  static applyPromo = handle("Promo code applied", async (req) => {
    const { params, body } = input(req, promoSchema);
    return svc().applyPromo(await org(req), params.id, cartTokenOf(req), body.code, customer(req));
  });
  static removePromo = handle("Promo code removed", async (req) => svc().applyPromo(await org(req), input(req, cartParamsSchema).params.id, cartTokenOf(req), null, customer(req)));
  static switchBranch = handle("Branch changed", async (req) => {
    const { params, body } = input(req, switchBranchSchema);
    return svc().switchBranch(await org(req), params.id, cartTokenOf(req), body.branchId, body.menuId, customer(req));
  });
}
