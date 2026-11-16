import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { PromoService } from "../services/promo.service";
import { createPromoSchema, listPromosSchema, promoIdSchema, updatePromoSchema } from "../validators/promo.schema";

export class PromoController {
  static list = handle("Promo codes fetched", async (req) => Paged.of(await PromoService.Instance.list(actorOf(req), input(req, listPromosSchema).query)));
  static create = handle("Promo code created", (req) => PromoService.Instance.create(actorOf(req), input(req, createPromoSchema).body), 201);
  static update = handle("Promo code updated", (req) => {
    const { params, body } = input(req, updatePromoSchema);
    return PromoService.Instance.update(actorOf(req), params.id, body);
  });
  static remove = handle("Promo code deleted", (req) => PromoService.Instance.remove(actorOf(req), input(req, promoIdSchema).params.id));
}
