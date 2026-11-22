// Saved vendors & customers ("parties") and each entry's split between them.
import { In } from "typeorm";
import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { FinanceEntryPartyEntity, FinancePartyEntity, type FinanceParty } from "../entities/financeParty.entity";

export interface PartyRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  /** Live entries that use this party (within the caller's branch scope). */
  entries: number;
  /** Their total share, kobo. */
  total: number;
  lastUsed: string | null;
  /** Which kinds of entry it has been used on (expense, income, capital, withdrawal). */
  kinds: string[];
}

export interface EntryPartyLine {
  entryId: string;
  partyId: string;
  name: string;
  amount: number;
}

/** finance_entries.party is the readable "A, B, C" list, capped to its column size. */
export function joinNames(names: string[]): string | null {
  if (!names.length) return null;
  const s = names.join(", ");
  return s.length <= 160 ? s : `${s.slice(0, 159)}…`;
}

export class PartyRepository {
  static Instance = new PartyRepository();
  private constructor() {}

  async list(organizationId: string, branchIds: string[] | null): Promise<PartyRow[]> {
    const p = new SqlParams();
    const org = p.add(organizationId);
    const scope = branchIds ? ` AND e.branch_id = ANY(${p.add(branchIds)}::uuid[])` : "";
    const rows: PartyRow[] = await db().query(
      `SELECT pa.id, pa.name, pa.phone, pa.notes,
              COUNT(e.id)::int AS entries,
              COALESCE(SUM(l.amount) FILTER (WHERE e.id IS NOT NULL), 0) AS total,
              MAX(e.entry_date)::text AS "lastUsed",
              COALESCE(array_agg(DISTINCT e.kind) FILTER (WHERE e.kind IS NOT NULL), '{}') AS kinds
       FROM finance_parties pa
       LEFT JOIN finance_entry_parties l ON l.party_id = pa.id
       LEFT JOIN finance_entries e ON e.id = l.entry_id AND e.deleted_at IS NULL${scope}
       WHERE pa.organization_id = ${org} AND pa.deleted_at IS NULL
       GROUP BY pa.id ORDER BY lower(pa.name)`,
      p.values
    );
    return rows.map((r) => ({ ...r, total: Number(r.total) }));
  }

  findById(organizationId: string, id: string, tx?: Tx): Promise<FinanceParty | null> {
    return db(tx).getRepository(FinancePartyEntity).findOne({ where: { id, organizationId } });
  }

  async findByIds(organizationId: string, ids: string[], tx?: Tx): Promise<FinanceParty[]> {
    if (!ids.length) return [];
    return db(tx).getRepository(FinancePartyEntity).findBy({ organizationId, id: In(ids) });
  }

  async findByName(organizationId: string, name: string, tx?: Tx): Promise<FinanceParty | null> {
    const rows: Array<{ id: string }> = await db(tx).query(`SELECT id FROM finance_parties WHERE organization_id = $1 AND deleted_at IS NULL AND lower(name) = lower($2) LIMIT 1`, [organizationId, name.trim()]);
    return rows[0] ? this.findById(organizationId, rows[0].id, tx) : null;
  }

  /** Name → party id, creating the missing ones (case-insensitive; the first spelling seen wins). */
  async findOrCreate(organizationId: string, names: string[], tx: Tx): Promise<Map<string, string>> {
    const wanted = new Map<string, string>();
    for (const n of names) {
      const name = n.trim().slice(0, 160);
      if (name && !wanted.has(name.toLowerCase())) wanted.set(name.toLowerCase(), name);
    }
    const out = new Map<string, string>();
    if (!wanted.size) return out;
    const existing: Array<{ id: string; key: string }> = await tx.query(
      `SELECT id, lower(name) AS key FROM finance_parties WHERE organization_id = $1 AND deleted_at IS NULL AND lower(name) = ANY($2::text[])`,
      [organizationId, [...wanted.keys()]]
    );
    for (const r of existing) out.set(r.key, r.id);
    for (const [key, name] of wanted) {
      if (out.has(key)) continue;
      const created = await tx.getRepository(FinancePartyEntity).save(tx.getRepository(FinancePartyEntity).create({ organizationId, name, phone: null, notes: null }));
      out.set(key, created.id);
    }
    return out;
  }

  async create(organizationId: string, data: { name: string; phone: string | null; notes: string | null }, tx?: Tx): Promise<FinanceParty> {
    const repo = db(tx).getRepository(FinancePartyEntity);
    return repo.save(repo.create({ organizationId, ...data }));
  }

  async update(organizationId: string, id: string, data: Partial<Pick<FinanceParty, "name" | "phone" | "notes">>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(FinancePartyEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(FinancePartyEntity).softDelete({ id, organizationId });
  }

  /** Live entries using the party (all branches). */
  async usage(id: string, tx?: Tx): Promise<number> {
    const rows: Array<{ n: number }> = await db(tx).query(
      `SELECT COUNT(DISTINCT e.id)::int AS n FROM finance_entry_parties l JOIN finance_entries e ON e.id = l.entry_id AND e.deleted_at IS NULL WHERE l.party_id = $1`,
      [id]
    );
    return rows[0]?.n ?? 0;
  }

  // ── Entry lines ──────────────────────────────────────────────────────────

  async linesFor(entryIds: string[], tx?: Tx): Promise<EntryPartyLine[]> {
    if (!entryIds.length) return [];
    const rows: EntryPartyLine[] = await db(tx).query(
      `SELECT l.entry_id AS "entryId", l.party_id AS "partyId", pa.name, l.amount
       FROM finance_entry_parties l JOIN finance_parties pa ON pa.id = l.party_id
       WHERE l.entry_id = ANY($1::uuid[]) ORDER BY l.sort_order, l.id`,
      [entryIds]
    );
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  async replaceLines(entryId: string, lines: Array<{ partyId: string; amount: number }>, tx: Tx): Promise<void> {
    await tx.query(`DELETE FROM finance_entry_parties WHERE entry_id = $1`, [entryId]);
    if (lines.length) await tx.getRepository(FinanceEntryPartyEntity).insert(lines.map((l, i) => ({ entryId, partyId: l.partyId, amount: l.amount, sortOrder: i })));
  }

  async insertLines(rows: Array<{ entryId: string; partyId: string; amount: number; sortOrder: number }>, tx: Tx): Promise<void> {
    for (let i = 0; i < rows.length; i += 500) await tx.getRepository(FinanceEntryPartyEntity).insert(rows.slice(i, i + 500));
  }

  /** Move every line from one party to another; an entry that had both ends up with one combined line. */
  async merge(fromId: string, intoId: string, tx: Tx): Promise<number> {
    const affected: Array<{ entry_id: string }> = await tx.query(`SELECT DISTINCT entry_id FROM finance_entry_parties WHERE party_id = $1`, [fromId]);
    await tx.query(`UPDATE finance_entry_parties SET party_id = $2 WHERE party_id = $1`, [fromId, intoId]);
    const dupes: Array<{ entry_id: string; keep: string; total: number }> = await tx.query(
      `SELECT entry_id, (array_agg(id ORDER BY sort_order, id))[1]::text AS keep, SUM(amount) AS total
       FROM finance_entry_parties WHERE party_id = $1 GROUP BY entry_id HAVING COUNT(*) > 1`,
      [intoId]
    );
    for (const d of dupes) {
      await tx.query(`UPDATE finance_entry_parties SET amount = $2 WHERE id = $1`, [d.keep, Number(d.total)]);
      await tx.query(`DELETE FROM finance_entry_parties WHERE entry_id = $1 AND party_id = $2 AND id <> $3`, [d.entry_id, intoId, d.keep]);
    }
    await this.refreshNames(affected.map((a) => a.entry_id), tx);
    return affected.length;
  }

  /** Rewrite the readable finance_entries.party text for these entries (or every entry using a party). */
  async refreshNames(entryIds: string[], tx: Tx): Promise<void> {
    if (!entryIds.length) return;
    await tx.query(
      `UPDATE finance_entries e SET party = CASE WHEN length(s.names) > 160 THEN left(s.names, 159) || '…' ELSE s.names END
       FROM (SELECT l.entry_id, string_agg(pa.name, ', ' ORDER BY l.sort_order, l.id) AS names
             FROM finance_entry_parties l JOIN finance_parties pa ON pa.id = l.party_id
             WHERE l.entry_id = ANY($1::uuid[]) GROUP BY l.entry_id) s
       WHERE e.id = s.entry_id`,
      [entryIds]
    );
  }

  async entryIdsUsing(partyId: string, tx: Tx): Promise<string[]> {
    const rows: Array<{ entry_id: string }> = await tx.query(`SELECT DISTINCT entry_id FROM finance_entry_parties WHERE party_id = $1`, [partyId]);
    return rows.map((r) => r.entry_id);
  }
}
