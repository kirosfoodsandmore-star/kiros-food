import { actorOf, handle, input } from "../../../shared/http/handler";
import { requireFile } from "../../../shared/middleware/upload.middleware";
import { ContactService } from "../services/contact.service";
import { OrganizationService } from "../services/organization.service";
import { contactMessageSchema } from "../validators/contact.schema";
import { slugParams, updateRestaurantSchema } from "../validators/organization.schema";

export class OrganizationController {
  static settings = handle("Settings fetched", (req) => OrganizationService.Instance.profile(actorOf(req).organizationId));
  static update = handle("Settings updated", (req) => OrganizationService.Instance.update(actorOf(req), input(req, updateRestaurantSchema).body));
  static uploadLogo = handle("Logo updated", (req) => OrganizationService.Instance.uploadLogo(actorOf(req), requireFile(req).buffer));
  static removeLogo = handle("Logo removed", (req) => OrganizationService.Instance.removeLogo(actorOf(req)));

  /** Storefront: the "Get in touch" form. */
  static contact = handle("Message sent", (req) => {
    const { params, body } = input(req, contactMessageSchema);
    return ContactService.Instance.send(params.slug, body);
  });

  /** Storefront: public profile by slug. */
  static storefront = handle("Restaurant fetched", (req) => OrganizationService.Instance.storefront(input(req, slugParams).params.slug));
}
