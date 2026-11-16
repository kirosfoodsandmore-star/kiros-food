import { actorOf, clientOf, customerOf, handle, input, Paged } from "../../../shared/http/handler";
import { OrganizationService } from "../../organization/services/organization.service";
import { CustomerAuthService } from "../services/customerAuth.service";
import { CustomerEmailAuthService } from "../services/customerEmailAuth.service";
import { CustomerService } from "../services/customer.service";
import {
  addressIdSchema,
  blockCustomerSchema,
  createAddressSchema,
  customerFirebaseSignInSchema,
  customerEmailStartSchema,
  customerEmailVerifySchema,
  customerGuestSchema,
  customerIdSchema,
  customerRefreshSchema,
  listCustomersSchema,
  updateAddressSchema,
  updateCustomerSchema,
} from "../validators/customer.schema";

const store = (slug: string) => OrganizationService.Instance.resolveStore(slug);

export class CustomerController {
  // Storefront auth
  static firebase = handle("Signed in", async (req) => {
    const { params, body } = input(req, customerFirebaseSignInSchema);
    return CustomerAuthService.Instance.signInWithFirebase((await store(params.slug)).id, body, clientOf(req));
  });
  static guest = handle("Guest session started", async (req) => {
    const { params, body } = input(req, customerGuestSchema);
    return CustomerAuthService.Instance.signInAsGuest((await store(params.slug)).id, body, clientOf(req));
  }, 201);
  static emailStart = handle("Code sent", async (req) => {
    const { params, body } = input(req, customerEmailStartSchema);
    return CustomerEmailAuthService.Instance.request((await store(params.slug)).id, body.email);
  });
  static emailVerify = handle("Signed in", async (req) => {
    const { params, body } = input(req, customerEmailVerifySchema);
    return CustomerEmailAuthService.Instance.verify((await store(params.slug)).id, body, req.customer ?? null, clientOf(req));
  });
  static refresh = handle("Session refreshed", async (req) => {
    const { params, body } = input(req, customerRefreshSchema);
    return CustomerAuthService.Instance.refresh((await store(params.slug)).id, body.refreshToken, clientOf(req));
  });
  static logout = handle("Signed out", (req) => CustomerAuthService.Instance.logout(input(req, customerRefreshSchema).body.refreshToken));
  static me = handle("Account fetched", (req) => CustomerAuthService.Instance.session(customerOf(req)));
  static updateMe = handle("Account updated", (req) => CustomerService.Instance.updateMe(customerOf(req), input(req, updateCustomerSchema).body));

  // Storefront addresses
  static addresses = handle("Addresses fetched", (req) => CustomerService.Instance.addresses(customerOf(req)));
  static addAddress = handle("Address saved", (req) => CustomerService.Instance.addAddress(customerOf(req), input(req, createAddressSchema).body), 201);
  static updateAddress = handle("Address updated", (req) => {
    const { params, body } = input(req, updateAddressSchema);
    return CustomerService.Instance.updateAddress(customerOf(req), params.id, body);
  });
  static deleteAddress = handle("Address removed", (req) => CustomerService.Instance.deleteAddress(customerOf(req), input(req, addressIdSchema).params.id));

  // Admin
  static list = handle("Customers fetched", async (req) => Paged.of(await CustomerService.Instance.list(actorOf(req), input(req, listCustomersSchema).query)));
  static get = handle("Customer fetched", (req) => CustomerService.Instance.get(actorOf(req), input(req, customerIdSchema).params.id));
  static block = handle("Customer blocked", (req) => {
    const { params, body } = input(req, blockCustomerSchema);
    return CustomerService.Instance.setBlocked(actorOf(req), params.id, true, body.reason ?? null);
  });
  static unblock = handle("Customer unblocked", (req) => CustomerService.Instance.setBlocked(actorOf(req), input(req, customerIdSchema).params.id, false, null));
}
