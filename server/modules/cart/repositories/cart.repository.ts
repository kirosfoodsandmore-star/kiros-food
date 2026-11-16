import { db, type Tx } from "../../../infrastructure/database/transaction";
import { CartEntity, type Cart } from "../entities/cart.entity";
import { CartLineEntity, type CartLine } from "../entities/cartLine.entity";

export class CartRepository {
  static Instance = new CartRepository();
  private constructor() {}

  async create(data: Omit<Cart, "id" | "createdAt" | "updatedAt">, tx?: Tx): Promise<Cart> {
    const repo = db(tx).getRepository(CartEntity);
    return repo.save(repo.create(data));
  }

  async findByTokenHash(organizationId: string, tokenHash: string, tx?: Tx): Promise<Cart | null> {
    return db(tx).getRepository(CartEntity).findOne({ where: { organizationId, tokenHash } });
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<Cart | null> {
    return db(tx).getRepository(CartEntity).findOne({ where: { organizationId, id } });
  }

  async update(id: string, data: Partial<Cart>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CartEntity).update({ id }, data);
  }

  async lines(cartId: string, tx?: Tx): Promise<CartLine[]> {
    return db(tx).getRepository(CartLineEntity).find({ where: { cartId }, order: { createdAt: "ASC" }, take: 100 });
  }

  async addLine(data: Omit<CartLine, "id" | "createdAt">, tx?: Tx): Promise<CartLine> {
    const repo = db(tx).getRepository(CartLineEntity);
    return repo.save(repo.create(data));
  }

  async updateLine(cartId: string, id: string, data: Partial<CartLine>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CartLineEntity).update({ id, cartId }, data);
  }

  async removeLine(cartId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CartLineEntity).delete({ id, cartId });
  }

  async clearLines(cartId: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CartLineEntity).delete({ cartId });
  }

  async delete(id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(CartEntity).delete({ id });
  }

  async purgeExpired(): Promise<number> {
    const result: unknown = await db().query(`DELETE FROM carts WHERE expires_at < now()`);
    return Array.isArray(result) && typeof result[1] === "number" ? result[1] : 0;
  }
}
