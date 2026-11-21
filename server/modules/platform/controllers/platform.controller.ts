import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { PlatformService } from "../services/platform.service";
import { emailLogsSchema, emailLogSummarySchema, listRestaurantsSchema, restaurantIdSchema, updatePlatformSettingsSchema } from "../validators/platform.schema";

export class PlatformController {
  static overview = handle("Platform overview", (req) => PlatformService.Instance.overview(actorOf(req)));
  static restaurants = handle("Restaurants fetched", async (req) => Paged.of(await PlatformService.Instance.restaurants(actorOf(req), input(req, listRestaurantsSchema).query)));
  static settings = handle("Platform settings", (req) => PlatformService.Instance.getSettings(actorOf(req)));
  static updateSettings = handle("Platform settings saved", (req) => PlatformService.Instance.updateSettings(actorOf(req), input(req, updatePlatformSettingsSchema).body));
  static emailLogs = handle("Email log fetched", async (req) => Paged.of(await PlatformService.Instance.emailLogs(actorOf(req), input(req, emailLogsSchema).query)));
  static emailLogSummary = handle("Email log summary", (req) => PlatformService.Instance.emailLogSummary(actorOf(req), input(req, emailLogSummarySchema).query));
  static online = handle("Online staff", async (req) => PlatformService.Instance.online(actorOf(req)));
  static suspend = handle("Restaurant suspended", (req) => PlatformService.Instance.setSuspended(actorOf(req), input(req, restaurantIdSchema).params.id, true));
  static unsuspend = handle("Restaurant reinstated", (req) => PlatformService.Instance.setSuspended(actorOf(req), input(req, restaurantIdSchema).params.id, false));
}
