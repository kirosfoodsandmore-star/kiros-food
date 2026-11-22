import { actorOf, clientOf, customerOf, handle, input } from "../../../shared/http/handler";
import { PushService } from "../services/push.service";
import { pushTokenSchema } from "../validators/push.schema";

export class PushController {
  static status = handle("Notification status fetched", (req) => PushService.Instance.status(actorOf(req)));
  static test = handle("Test notification sent", (req) => PushService.Instance.sendTest(actorOf(req)));
  static register = handle("Notifications turned on for this device", async (req) => {
    await PushService.Instance.registerDevice(actorOf(req), input(req, pushTokenSchema).body.token, clientOf(req).userAgent);
    return null;
  });
  static unregister = handle("Notifications turned off for this device", async (req) => {
    await PushService.Instance.unregisterDevice(actorOf(req), input(req, pushTokenSchema).body.token);
    return null;
  });

  // A signed-in customer turns reply alerts on or off for their own device.
  static customerRegister = handle("Reply alerts turned on for this device", async (req) => {
    await PushService.Instance.registerCustomerDevice(customerOf(req), input(req, pushTokenSchema).body.token, clientOf(req).userAgent);
    return null;
  });
  static customerUnregister = handle("Reply alerts turned off for this device", async (req) => {
    await PushService.Instance.unregisterCustomerDevice(customerOf(req), input(req, pushTokenSchema).body.token);
    return null;
  });
}
