import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { AddressDTO, CustomerDTO } from "../dto/customer.dto";
import { AddressEntity, type Address } from "../entities/address.entity";
import { CustomerEntity, type Customer } from "../entities/customer.entity";

const SELECT = `SELECT c.id, c.phone, c.name, c.email, c.is_blocked AS "isBlocked", c.block_reason AS "blockReason", c.order_count AS "orderCount",
  c.total_spend AS "totalSpend", c.last_order_at AS "lastOrderAt", c.created_at AS "createdAt" FROM customers c`;

export class CustomerRepository {
  static Instance = new CustomerRepository();
  private constructor() {}

  async findById(organizationId: string, id: string, tx?: Tx): Promise<Customer | null> {
    return db(tx).getRepository(CustomerEntity).findOne({ where: { id, organizationId } });
  }

  async findByUid(organizationId: string, firebaseUid: string): Promise<Customer | null> {
    return db().getRepository(CustomerEntity).findOne({ where: { organizationId, firebaseUid } });
  }

  async findByPhone(organizationId: string, phone: string, tx?: Tx): Promise<Customer | null> {
    return db(tx).getRepository(CustomerEntity).findOne({ where: { organizationId, phone } });
  }

  async findByEmail(organizationId: string, email: string): Promise<Customer | null> {
    return db().getRepository(CustomerEntity).findOne({ where: { organizationId, email: email.toLowerCase() } });
  }

  /** Every customer record that used this address (stored lowercase), oldest first. */
  async findAllByEmail(organizationId: string, email: string, tx?: Tx): Promise<Customer[]> {
    return db(tx).getRepository(CustomerEntity).createQueryBuilder("c").where("c.organizationId = :organizationId AND lower(c.email) = :email", { organizationId, email: email.toLowerCase() }).orderBy("c.createdAt", "ASC").getMany();
  }

  /**
   * Folds one customer record into another: orders, chats, bags and saved addresses move across, the lifetime
   * stats are added up, and the old record (with its sessions) is deleted. Returns the old record's phone so the
   * caller can hand it to the survivor once the unique phone number is free again.
   */
  async mergeInto(primaryId: string, otherId: string, tx: Tx): Promise<{ phone: string | null }> {
    for (const table of ["orders", "chat_conversations", "carts", "addresses"]) await tx.query(`UPDATE ${table} SET customer_id = $1 WHERE customer_id = $2`, [primaryId, otherId]);
    await tx.query(
      `UPDATE customers SET order_count = customers.order_count + o.order_count, total_spend = customers.total_spend + o.total_spend, last_order_at = GREATEST(customers.last_order_at, o.last_order_at)
       FROM (SELECT order_count, total_spend, last_order_at FROM customers WHERE id = $2) o WHERE customers.id = $1`,
      [primaryId, otherId]
    );
    const rows: Array<{ phone: string | null }> = await tx.query(`SELECT phone FROM customers WHERE id = $1`, [otherId]);
    await tx.query(`DELETE FROM refresh_tokens WHERE subject_type = 'customer' AND subject_id = $1`, [otherId]);
    await tx.query(`DELETE FROM customers WHERE id = $1`, [otherId]);
    return { phone: rows[0]?.phone ?? null };
  }

  async create(data: Partial<Customer> & { organizationId: string }, tx?: Tx): Promise<Customer> {
    const repo = db(tx).getRepository(CustomerEntity);
    return repo.save(repo.create(data));
  }

  async update(organizationId: string, id: string, data: Partial<Customer>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CustomerEntity).update({ id, organizationId }, data);
  }

  async recordOrder(id: string, total: number, tx: Tx): Promise<void> {
    await tx.query(`UPDATE customers SET order_count = order_count + 1, total_spend = total_spend + $2, last_order_at = now() WHERE id = $1`, [id, total]);
  }

  async list(organizationId: string, f: { page: number; limit: number; search?: string; blocked?: boolean; branchIds?: string[] | null }): Promise<PagedRows<CustomerDTO>> {
    const p = new SqlParams();
    const where = [`c.organization_id = ${p.add(organizationId)}`];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(c.phone ILIKE ${s} OR c.name ILIKE ${s} OR c.email ILIKE ${s})`);
    }
    if (f.blocked !== undefined) where.push(`c.is_blocked = ${p.add(f.blocked)}`);
    if (f.branchIds) where.push(`EXISTS (SELECT 1 FROM orders so WHERE so.customer_id = c.id AND so.branch_id = ANY(${p.add(f.branchIds)}::uuid[]))`);
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT} WHERE ${where.join(" AND ")}) x
       ORDER BY x."lastOrderAt" DESC NULLS LAST, x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<CustomerDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async detail(organizationId: string, id: string, branchIds: string[] | null = null): Promise<CustomerDTO | null> {
    const rows: CustomerDTO[] = await db().query(
      `${SELECT} WHERE c.organization_id = $1 AND c.id = $2 AND ($3::uuid[] IS NULL OR EXISTS (SELECT 1 FROM orders so WHERE so.customer_id = c.id AND so.branch_id = ANY($3::uuid[])))`,
      [organizationId, id, branchIds]
    );
    return rows[0] ?? null;
  }

  // ── Addresses ──────────────────────────────────────────────────────────────

  async addresses(customerId: string): Promise<AddressDTO[]> {
    return db().query(
      `SELECT id, label, line, lat, lng, instructions, is_default AS "isDefault" FROM addresses WHERE customer_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC LIMIT 20`,
      [customerId]
    );
  }

  async findAddress(customerId: string, id: string): Promise<Address | null> {
    return db().getRepository(AddressEntity).findOne({ where: { id, customerId } });
  }

  async createAddress(data: Omit<Address, "id" | "createdAt" | "deletedAt">): Promise<Address> {
    const repo = db().getRepository(AddressEntity);
    if (data.isDefault) await repo.update({ customerId: data.customerId }, { isDefault: false });
    return repo.save(repo.create(data));
  }

  async updateAddress(customerId: string, id: string, data: Partial<Address>): Promise<void> {
    const repo = db().getRepository(AddressEntity);
    if (data.isDefault) await repo.update({ customerId }, { isDefault: false });
    await repo.update({ id, customerId }, data);
  }

  async deleteAddress(customerId: string, id: string): Promise<void> {
    await db().getRepository(AddressEntity).softDelete({ id, customerId });
  }
}
