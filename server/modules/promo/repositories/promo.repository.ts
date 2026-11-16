import { ILike } from "typeorm";
import { likePattern } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { buildMetaFromTotal, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { PromoCodeEntity, type PromoCode } from "../entities/promoCode.entity";

export class PromoRepository {
  static Instance = new PromoRepository();
  private constructor() {}

  async list(organizationId: string, f: { page: number; limit: number; search?: string }): Promise<PagedRows<PromoCode>> {
    const where = f.search ? { organizationId, code: ILike(likePattern(f.search)) } : { organizationId };
    const [data, total] = await db().getRepository(PromoCodeEntity).findAndCount({ where, order: { createdAt: "DESC", id: "DESC" }, skip: getOffset(f.page, f.limit), take: f.limit });
    return { data, meta: buildMetaFromTotal(f.page, f.limit, total) };
  }

  async findById(organizationId: string, id: string): Promise<PromoCode | null> {
    return db().getRepository(PromoCodeEntity).findOne({ where: { id, organizationId } });
  }

  async findByCode(organizationId: string, code: string, tx?: Tx): Promise<PromoCode | null> {
    return db(tx).getRepository(PromoCodeEntity).findOne({ where: { organizationId, code: code.toUpperCase() } });
  }

  async create(data: Omit<PromoCode, "id" | "createdAt" | "updatedAt" | "deletedAt" | "usedCount">): Promise<PromoCode> {
    const repo = db().getRepository(PromoCodeEntity);
    return repo.save(repo.create({ ...data, usedCount: 0 }));
  }

  async update(organizationId: string, id: string, data: Partial<PromoCode>): Promise<void> {
    await db().getRepository(PromoCodeEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    await db().getRepository(PromoCodeEntity).softDelete({ id, organizationId });
  }

  /** Redeem atomically: fails (returns false) when the usage cap is already reached. */
  async redeem(id: string, tx: Tx): Promise<boolean> {
    const result: unknown = await tx.query(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses) RETURNING id`, [id]);
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : (result as unknown[]);
    return rows.length > 0;
  }

  async usesByCustomer(organizationId: string, code: string, customerId: string): Promise<number> {
    const rows: Array<{ n: number }> = await db().query(
      `SELECT COUNT(*)::int AS n FROM orders WHERE organization_id = $1 AND customer_id = $2 AND promo_code = $3 AND status NOT IN ('cancelled')`,
      [organizationId, customerId, code.toUpperCase()]
    );
    return rows[0]?.n ?? 0;
  }
}
