import { db, type Tx } from "../../../infrastructure/database/transaction";
import { BankAccountEntity, type BankAccount } from "../entities/bankAccount.entity";
import { PaymentSettingsEntity, type PaymentSettings } from "../entities/paymentSettings.entity";

export class PaymentSettingsRepository {
  static Instance = new PaymentSettingsRepository();
  private constructor() {}

  async ensure(organizationId: string, tx?: Tx): Promise<PaymentSettings> {
    const repo = db(tx).getRepository(PaymentSettingsEntity);
    const existing = await repo.findOne({ where: { organizationId } });
    if (existing) return existing;
    return repo.save(repo.create({ organizationId, paystackEnabled: false, transferEnabled: true, paystackPublicKey: null, paystackSecretKeySealed: null, paystackMode: "test", transferWindowMinutes: 30, transferInstructions: null }));
  }

  async update(organizationId: string, data: Partial<PaymentSettings>): Promise<void> {
    await db().getRepository(PaymentSettingsEntity).update({ organizationId }, data);
  }

  async bankAccounts(organizationId: string, activeOnly = false): Promise<BankAccount[]> {
    return db().getRepository(BankAccountEntity).find({ where: { organizationId, ...(activeOnly ? { isActive: true } : {}) }, order: { sortOrder: "ASC", createdAt: "ASC" }, take: 50 });
  }

  async findBankAccount(organizationId: string, id: string): Promise<BankAccount | null> {
    return db().getRepository(BankAccountEntity).findOne({ where: { id, organizationId } });
  }

  async createBankAccount(data: Omit<BankAccount, "id" | "createdAt" | "updatedAt" | "deletedAt">): Promise<BankAccount> {
    const repo = db().getRepository(BankAccountEntity);
    return repo.save(repo.create(data));
  }

  async updateBankAccount(organizationId: string, id: string, data: Partial<BankAccount>): Promise<void> {
    await db().getRepository(BankAccountEntity).update({ id, organizationId }, data);
  }

  async deleteBankAccount(organizationId: string, id: string): Promise<void> {
    await db().getRepository(BankAccountEntity).softDelete({ id, organizationId });
  }
}
