import { Router } from "express";
import { publicRoute } from "../../../shared/access/can";
import { optionalCustomerAuth } from "../../../shared/middleware/customerAuth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { CartController as C } from "../controllers/cart.controller";
import { addLineSchema, cartParamsSchema, createCartSchema, lineParamsSchema, promoSchema, switchBranchSchema, updateCartSchema, updateLineSchema } from "../validators/cart.schema";

/** /api/v1/store/:slug/carts (mergeParams). Guests may build a cart; the X-Cart-Token header is the key. */
const router = Router({ mergeParams: true });

router.post("/", publicRoute("create a cart"), optionalCustomerAuth, validate(createCartSchema), C.create);
router.get("/:id", publicRoute("read a cart by token"), optionalCustomerAuth, validate(cartParamsSchema), C.get);
router.patch("/:id", publicRoute("update fulfilment, time, address, phone"), optionalCustomerAuth, validate(updateCartSchema), C.update);
router.post("/:id/lines", publicRoute("add a line"), optionalCustomerAuth, validate(addLineSchema), C.addLine);
router.patch("/:id/lines/:lineId", publicRoute("update a line"), optionalCustomerAuth, validate(updateLineSchema), C.updateLine);
router.delete("/:id/lines/:lineId", publicRoute("remove a line"), optionalCustomerAuth, validate(lineParamsSchema), C.removeLine);
router.delete("/:id/lines", publicRoute("clear the cart"), optionalCustomerAuth, validate(cartParamsSchema), C.clear);
router.post("/:id/promo", publicRoute("apply a promo code"), optionalCustomerAuth, validate(promoSchema), C.applyPromo);
router.delete("/:id/promo", publicRoute("remove the promo code"), optionalCustomerAuth, validate(cartParamsSchema), C.removePromo);
router.post("/:id/branch", publicRoute("switch branch and revalidate"), optionalCustomerAuth, validate(switchBranchSchema), C.switchBranch);

export default router;
