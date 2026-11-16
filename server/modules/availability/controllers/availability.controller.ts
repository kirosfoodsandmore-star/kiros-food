import { actorOf, handle, input } from "../../../shared/http/handler";
import { AvailabilityService } from "../services/availability.service";
import { bulkSetAvailabilitySchema, listAvailabilitySchema, setAvailabilitySchema } from "../validators/availability.schema";

export class AvailabilityController {
  static list = handle("Sold-out list fetched", (req) => AvailabilityService.Instance.list(actorOf(req), input(req, listAvailabilitySchema).query.branchId));
  static set = handle("Availability updated", (req) => AvailabilityService.Instance.set(actorOf(req), input(req, setAvailabilitySchema).body));
  static setMany = handle("Availability updated", (req) => AvailabilityService.Instance.setMany(actorOf(req), input(req, bulkSetAvailabilitySchema).body));
}
