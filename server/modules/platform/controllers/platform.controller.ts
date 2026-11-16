import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { PlatformService } from "../services/platform.service";
import { listRestaurantsSchema, restaurantIdSchema } from "../validators/platform.schema";

export class PlatformController {
  static overview = handle("Platform overview", (req) => PlatformService.Instance.overview(actorOf(req)));
  static restaurants = handle("Restaurants fetched", async (req) => Paged.of(await PlatformService.Instance.restaurants(actorOf(req), input(req, listRestaurantsSchema).query)));
  static online = handle("Online staff", async (req) => PlatformService.Instance.online(actorOf(req)));
  static suspend = handle("Restaurant suspended", (req) => PlatformService.Instance.setSuspended(actorOf(req), input(req, restaurantIdSchema).params.id, true));
  static unsuspend = handle("Restaurant reinstated", (req) => PlatformService.Instance.setSuspended(actorOf(req), input(req, restaurantIdSchema).params.id, false));
}
