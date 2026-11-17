import { actorOf, handle, input } from "../../../shared/http/handler";
import { OrganizationService } from "../../organization/services/organization.service";
import { BranchService } from "../services/branch.service";
import {
  addClosureSchema,
  branchIdSchema,
  bulkDeleteBranchesSchema,
  closureIdSchema,
  createBranchSchema,
  createZoneSchema,
  listBranchesQuerySchema,
  pauseBranchSchema,
  setHoursSchema,
  storeBranchesSchema,
  storeBranchIdSchema,
  storeDeliveryQuoteSchema,
  storeSlotsSchema,
  updateBranchSchema,
  updateZoneSchema,
  zoneIdSchema,
} from "../validators/branch.schema";

const svc = () => BranchService.Instance;
const store = (slug: string) => OrganizationService.Instance.resolveStore(slug);

export class BranchController {
  static list = handle("Branches fetched", (req) => svc().list(actorOf(req), input(req, listBranchesQuerySchema).query.activeOnly ?? false));
  static get = handle("Branch fetched", (req) => svc().get(actorOf(req), input(req, branchIdSchema).params.id));
  static create = handle("Branch created", (req) => svc().create(actorOf(req), input(req, createBranchSchema).body), 201);
  static update = handle("Branch updated", (req) => {
    const { params, body } = input(req, updateBranchSchema);
    return svc().update(actorOf(req), params.id, body);
  });
  static remove = handle("Branch deleted", (req) => svc().remove(actorOf(req), input(req, branchIdSchema).params.id));
  static removeMany = handle("Branches deleted", (req) => svc().removeMany(actorOf(req), input(req, bulkDeleteBranchesSchema).body.ids));
  static pause = handle("Branch updated", (req) => {
    const { params, body } = input(req, pauseBranchSchema);
    return svc().setPaused(actorOf(req), params.id, body.paused, body.reason ?? null);
  });
  static setHours = handle("Opening hours saved", (req) => {
    const { params, body } = input(req, setHoursSchema);
    return svc().setHours(actorOf(req), params.id, body.hours);
  });
  static addClosure = handle("Closure added", (req) => {
    const { params, body } = input(req, addClosureSchema);
    return svc().addClosure(actorOf(req), params.id, body.date, body.reason ?? null);
  }, 201);
  static removeClosure = handle("Closure removed", (req) => {
    const { params } = input(req, closureIdSchema);
    return svc().removeClosure(actorOf(req), params.id, params.closureId);
  });
  static createZone = handle("Delivery zone added", (req) => {
    const { params, body } = input(req, createZoneSchema);
    return svc().createZone(actorOf(req), params.id, body);
  }, 201);
  static updateZone = handle("Delivery zone updated", (req) => {
    const { params, body } = input(req, updateZoneSchema);
    return svc().updateZone(actorOf(req), params.id, params.zoneId, body);
  });
  static deleteZone = handle("Delivery zone removed", (req) => {
    const { params } = input(req, zoneIdSchema);
    return svc().deleteZone(actorOf(req), params.id, params.zoneId);
  });

  // ── Storefront ─────────────────────────────────────────────────────────────
  static storeList = handle("Branches fetched", async (req) => {
    const { params, query } = input(req, storeBranchesSchema);
    const org = await store(params.slug);
    const at = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : undefined;
    return svc().storefrontList(org.id, at, query.q);
  });
  static storeGet = handle("Branch fetched", async (req) => {
    const { params } = input(req, storeBranchIdSchema);
    return svc().storefrontGet((await store(params.slug)).id, params.id);
  });
  static storeSlots = handle("Slots fetched", async (req) => {
    const { params, query } = input(req, storeSlotsSchema);
    const at = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : undefined;
    return svc().slots((await store(params.slug)).id, params.id, query.fulfilment, at);
  });
  static storeDeliveryQuote = handle("Delivery quote", async (req) => {
    const { params, query } = input(req, storeDeliveryQuoteSchema);
    return svc().deliveryQuote((await store(params.slug)).id, params.id, query.lat, query.lng, query.subtotal ?? 0);
  });
}
