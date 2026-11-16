import { db, type Tx } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { PaymentEntity, type Payment } from "../entities/payment.entity";

export interface PaymentQueueRow {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  customerPhone: string;
  customerName: string | null;
  amount: number;
  reference: string;
  status: string;
  proofUrl: string | null;
  claimNote: string | null;
  claimedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export class PaymentRepository {
  static Instance = new PaymentRepository();
  private constructor() {}

  async create(data: Omit<Payment, "id" | "createdAt" | "updatedAt">, tx?: Tx): Promise<Payment> {
    const repo = db(tx).getRepository(PaymentEntity);
    return repo.save(repo.create(data));
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<Payment | null> {
    return db(tx).getRepository(PaymentEntity).findOne({ where: { id, organizationId } });
  }

  async findByReference(reference: string, tx?: Tx): Promise<Payment | null> {
    return db(tx).getRepository(PaymentEntity).findOne({ where: { reference } });
  }

  /** Lock the payment row for an idempotent state change. */
  async findByReferenceForUpdate(reference: string, tx: Tx): Promise<Payment | null> {
    return tx.getRepository(PaymentEntity).createQueryBuilder("p").setLock("pessimistic_write").where("p.reference = :reference", { reference }).getOne();
  }

  async latestForOrder(orderId: string, tx?: Tx): Promise<Payment | null> {
    return db(tx).getRepository(PaymentEntity).findOne({ where: { orderId }, order: { createdAt: "DESC" } });
  }

  async update(id: string, data: Partial<Payment>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(PaymentEntity).update({ id }, data as Parameters<ReturnType<Tx["getRepository"]>["update"]>[1]);
  }

  async queue(organizationId: string, branchIds: string[] | null, statuses: string[], page: number, limit: number): Promise<PagedRows<PaymentQueueRow>> {
    const rows = await db().query(
      `SELECT COUNT(*) OVER() AS "__total", p.id, p.order_id AS "orderId", o.number AS "orderNumber", o.branch_id AS "branchId", b.name AS "branchName", o.customer_phone AS "customerPhone",
              o.customer_name AS "customerName", p.amount, p.reference, p.status, p.proof_url AS "proofUrl", p.claim_note AS "claimNote", p.claimed_at AS "claimedAt",
              p.expires_at AS "expiresAt", p.created_at AS "createdAt"
       FROM payments p JOIN orders o ON o.id = p.order_id JOIN branches b ON b.id = o.branch_id
       WHERE p.organization_id = $1 AND p.method = 'transfer' AND p.status = ANY($3::text[]) AND ($2::uuid[] IS NULL OR o.branch_id = ANY($2))
       ORDER BY p.claimed_at NULLS LAST, p.created_at, p.id LIMIT $4 OFFSET $5`,
      [organizationId, branchIds, statuses, limit, getOffset(page, limit)]
    );
    return fromWindowedRows<PaymentQueueRow & Record<string, unknown>>(rows, page, limit);
  }

  /** Pending payments whose deadline passed (transfer window or Paystack TTL). */
  async expiredPending(): Promise<Array<{ id: string; organizationId: string; orderId: string; method: string; status: string }>> {
    return db().query(
      `SELECT id, organization_id AS "organizationId", order_id AS "orderId", method, status FROM payments WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < now() LIMIT 200`
    );
  }
}
