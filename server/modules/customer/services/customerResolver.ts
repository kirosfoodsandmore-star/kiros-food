// Builds the CustomerActor for a storefront request from the database, so blocking a customer
// takes effect immediately.
import type { CustomerActor } from "../../../shared/types/actor";
import { CustomerRepository } from "../repositories/customer.repository";

export async function resolveCustomer(customerId: string, organizationId: string): Promise<CustomerActor | null> {
  const row = await CustomerRepository.Instance.findById(organizationId, customerId);
  if (!row || row.isBlocked) return null;
  return { id: row.id, organizationId: row.organizationId, phone: row.phone ?? "", name: row.name, email: row.email };
}
