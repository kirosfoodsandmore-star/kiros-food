import { likePattern, SqlParams } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";

export interface RestaurantRowDTO {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  isSuspended: boolean;
  branchCount: number;
  staffCount: number;
  orderCount: number;
  paidRevenue: number;
  ownerName: string | null;
  ownerEmail: string | null;
  lastOrderAt: Date | null;
  createdAt: Date;
}

export interface PresenceProfile {
  userId: string;
  organizationId: string;
  restaurantName: string;
  name: string;
  email: string;
  roleName: string;
}

export class PlatformRepository {
  static Instance = new PlatformRepository();
  private constructor() {}

  async restaurants(f: { page: number; limit: number; search?: string; suspended?: boolean }): Promise<PagedRows<RestaurantRowDTO>> {
    const p = new SqlParams();
    const where = ["true"];
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(o.name ILIKE ${s} OR o.slug ILIKE ${s} OR o.email ILIKE ${s})`);
    }
    if (f.suspended !== undefined) where.push(`o.is_suspended = ${p.add(f.suspended)}`);
    const rows = await db().query(
      `SELECT o.id, o.name, o.slug, o.email, o.phone, o.is_suspended AS "isSuspended", o.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM branches b WHERE b.organization_id = o.id AND b.deleted_at IS NULL) AS "branchCount",
              (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.deleted_at IS NULL AND u.is_active = true) AS "staffCount",
              (SELECT COUNT(*)::int FROM orders x WHERE x.organization_id = o.id) AS "orderCount",
              (SELECT COALESCE(SUM(x.total),0) FROM orders x WHERE x.organization_id = o.id AND x.status IN ('paid','accepted','preparing','ready','out_for_delivery','completed')) AS "paidRevenue",
              (SELECT MAX(x.created_at) FROM orders x WHERE x.organization_id = o.id) AS "lastOrderAt",
              ow.name AS "ownerName", ow.email AS "ownerEmail", COUNT(*) OVER() AS "__total"
       FROM organizations o
       LEFT JOIN LATERAL (SELECT u.name, u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE u.organization_id = o.id AND r.key = 'owner' AND u.deleted_at IS NULL ORDER BY u.created_at LIMIT 1) ow ON true
       WHERE ${where.join(" AND ")} ORDER BY o.created_at DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<RestaurantRowDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  async overview() {
    const rows = await db().query(
      `SELECT (SELECT COUNT(*)::int FROM organizations) AS restaurants,
              (SELECT COUNT(*)::int FROM organizations WHERE created_at > now() - interval '7 days') AS "newThisWeek",
              (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND is_active = true) AS staff,
              (SELECT COUNT(*)::int FROM customers) AS customers,
              (SELECT COUNT(*)::int FROM orders WHERE created_at > now() - interval '24 hours') AS "ordersLast24h",
              (SELECT COALESCE(SUM(total),0) FROM orders WHERE created_at > now() - interval '24 hours' AND status IN ('paid','accepted','preparing','ready','out_for_delivery','completed')) AS "revenueLast24h"`
    );
    return rows[0];
  }

  async presenceProfile(userId: string): Promise<PresenceProfile | null> {
    const rows: PresenceProfile[] = await db().query(
      `SELECT u.id AS "userId", u.organization_id AS "organizationId", o.name AS "restaurantName", u.name, u.email, r.name AS "roleName"
       FROM users u JOIN organizations o ON o.id = u.organization_id JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId]
    );
    return rows[0] ?? null;
  }
}
