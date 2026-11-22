// The business's own books: capital, expenses, off-app income and money taken out, plus monthly budgets.
// Owner-only by default (finance.view / finance.manage). Branch scope applies: someone limited to some branches only
// sees entries filed against those branches, never the business-wide ones.
import { assertPermission, can } from "../../../shared/access/can";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { formatMoney } from "../../../shared/utils/money";
import { AppError } from "../../../shared/errors/AppError";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { formatDateTime, todayIn } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { BranchService } from "../../branch/services/branch.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { categoryLabel, categoryOf, EXPENSE_GROUP_LABELS, FINANCE_CATEGORIES, FINANCE_KIND_LABELS, FINANCE_PAYMENT_METHODS } from "../catalog/finance.catalog";
import type { FinanceEntry } from "../entities/financeEntry.entity";
import { FinanceRepository, type NewEntry } from "../repositories/finance.repository";
import { joinNames, PartyRepository, type EntryPartyLine } from "../repositories/party.repository";
import { buildEntriesWorkbook, XLSX_MIME } from "./financeExport";
import type { BudgetRow, EntryBody, ListEntriesQuery, PartyBody, PartyLineBody, UpdateEntryBody, UpdatePartyBody } from "../validators/finance.schema";

export type FinanceEntryDTO = Omit<FinanceEntry, "organizationId" | "deletedAt" | "organization"> & {
  /** Who it was paid to / received from, with each one's share (adds up to amount). Empty when nobody was named. */
  parties: Array<{ partyId: string; name: string; amount: number }>;
};

interface ResolvedParties {
  lines: Array<{ partyId: string; amount: number }>;
  names: string[];
}

export function toEntryDTO(e: FinanceEntry, lines: EntryPartyLine[] = []): FinanceEntryDTO {
  const { organizationId: _o, deletedAt: _d, organization: _r, ...rest } = e;
  return { ...rest, parties: lines.map((l) => ({ partyId: l.partyId, name: l.name, amount: l.amount })) };
}

export class FinanceService {
  static Instance = new FinanceService();
  private constructor(
    private readonly repo = FinanceRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly audit = AuditService.Instance,
    private readonly branches = BranchService.Instance,
    private readonly parties = PartyRepository.Instance
  ) {}

  // ── Saved vendors & customers ────────────────────────────────────────────

  /** Everyone, with usage totals. Sales-only staff get only names already used on sales (no amounts). */
  async listParties(actor: Actor) {
    if (can(actor, "finance.view")) return this.parties.list(actor.organizationId, branchScope(actor));
    assertPermission(actor, "finance.record_sales");
    // Who counts as a customer is judged across every branch (otherwise vendors on business-wide costs would look
    // "unused" and leak into the list); amounts are dropped entirely.
    const rows = await this.parties.list(actor.organizationId, null);
    return rows
      .filter((r) => r.kinds.includes("income"))
      .map((r) => ({ id: r.id, name: r.name, phone: null, notes: null, entries: 0, total: 0, lastUsed: null, kinds: ["income"] }));
  }

  // ── Who may do what ──────────────────────────────────────────────────────
  // finance.manage: everything. finance.record_sales (without manage): record other income, and see, correct or
  // delete only the sales they recorded themselves, on the day they recorded them.

  private assertMayRecord(actor: Actor, kind: string): void {
    if (can(actor, "finance.manage")) return;
    if (!can(actor, "finance.record_sales")) throw AppError.forbidden();
    if (kind !== "income") throw AppError.forbidden("You can only record sales (other income)");
  }

  private async assertMayChange(actor: Actor, entry: FinanceEntry, newKind?: string): Promise<void> {
    if (can(actor, "finance.manage")) return;
    if (!can(actor, "finance.record_sales")) throw AppError.forbidden();
    const org = await this.organizations.findById(actor.organizationId);
    const tz = org?.timezone ?? "Africa/Lagos";
    if (entry.kind !== "income" || entry.createdBy !== actor.id) throw AppError.forbidden("You can only change sales you recorded yourself");
    if (todayIn(tz, entry.createdAt) !== todayIn(tz)) throw AppError.forbidden("Sales can only be changed on the day they were recorded. Ask a manager to correct this one.");
    if (newKind && newKind !== "income") throw AppError.forbidden("You can only record sales (other income)");
  }

  async createParty(actor: Actor, b: PartyBody) {
    assertPermission(actor, "finance.manage");
    if (await this.parties.findByName(actor.organizationId, b.name)) throw AppError.conflict(`"${b.name}" is already on your list`);
    const party = await this.parties.create(actor.organizationId, { name: b.name, phone: b.phone ?? null, notes: b.notes ?? null });
    await this.audit.log(actor, { action: "create", entityType: "finance_party", entityId: party.id, summary: `Added "${party.name}" to vendors & customers` });
    return party;
  }

  async updateParty(actor: Actor, id: string, b: UpdatePartyBody) {
    assertPermission(actor, "finance.manage");
    const party = await this.parties.findById(actor.organizationId, id);
    if (!party) throw AppError.notFound("Not found on your vendors & customers list");
    if (b.name && b.name.toLowerCase() !== party.name.toLowerCase()) {
      const clash = await this.parties.findByName(actor.organizationId, b.name);
      if (clash) throw AppError.conflict(`"${clash.name}" is already on your list. Merge the two instead.`, { conflictId: clash.id });
    }
    await inTransaction(async (tx) => {
      await this.parties.update(actor.organizationId, id, { name: b.name, phone: b.phone, notes: b.notes }, tx);
      if (b.name && b.name !== party.name) await this.parties.refreshNames(await this.parties.entryIdsUsing(id, tx), tx);
      await this.audit.log(actor, { action: "update", entityType: "finance_party", entityId: id, summary: b.name && b.name !== party.name ? `Renamed "${party.name}" to "${b.name}"` : `Edited "${party.name}"`, before: party as unknown as Record<string, unknown>, after: b }, tx);
    });
    return (await this.parties.findById(actor.organizationId, id))!;
  }

  async mergeParty(actor: Actor, id: string, intoId: string) {
    assertPermission(actor, "finance.manage");
    if (id === intoId) throw AppError.badRequest("Choose a different name to merge into");
    const [from, into] = await Promise.all([this.parties.findById(actor.organizationId, id), this.parties.findById(actor.organizationId, intoId)]);
    if (!from || !into) throw AppError.notFound("Not found on your vendors & customers list");
    const moved = await inTransaction(async (tx) => {
      const n = await this.parties.merge(id, intoId, tx);
      await this.parties.softDelete(actor.organizationId, id, tx);
      await this.audit.log(actor, { action: "merge", entityType: "finance_party", entityId: intoId, summary: `Merged "${from.name}" into "${into.name}" (${n} entries moved)` }, tx);
      return n;
    });
    return { moved, into };
  }

  async removeParty(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "finance.manage");
    const party = await this.parties.findById(actor.organizationId, id);
    if (!party) throw AppError.notFound("Not found on your vendors & customers list");
    const used = await this.parties.usage(id);
    if (used > 0) throw AppError.conflict(`"${party.name}" is on ${used} entr${used === 1 ? "y" : "ies"}. Merge it into another name instead, or change those entries first.`);
    await this.parties.softDelete(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "finance_party", entityId: id, summary: `Removed "${party.name}" from vendors & customers` });
  }

  categories() {
    return {
      kinds: Object.entries(FINANCE_KIND_LABELS).map(([key, label]) => ({ key, label })),
      groups: Object.entries(EXPENSE_GROUP_LABELS).map(([key, label]) => ({ key, label })),
      paymentMethods: FINANCE_PAYMENT_METHODS,
      categories: FINANCE_CATEGORIES,
    };
  }

  async list(actor: Actor, query: ListEntriesQuery) {
    let q: ListEntriesQuery & { createdBy?: string } = query;
    const scope = branchScope(actor, q.branchId);
    if (!can(actor, "finance.view")) {
      // Sales-only staff: their own sales, nothing else, and no downloads.
      assertPermission(actor, "finance.record_sales");
      if (q.format === "xlsx") throw AppError.forbidden();
      q = { ...q, kind: "income", createdBy: actor.id };
    }
    if (q.format === "xlsx") {
      assertPermission(actor, "reports.export");
      const [all, org, branches] = await Promise.all([
        this.repo.list(actor.organizationId, scope, { ...q, page: 1, limit: 20_000 }),
        this.organizations.findById(actor.organizationId),
        this.branches.list(actor),
      ]);
      const names = new Map(branches.map((b) => [b.id, b.name]));
      const tz = org?.timezone ?? "Africa/Lagos";
      const filters: Array<[string, string]> = [
        ["Period", q.from || q.to ? `${q.from ?? "the start"} to ${q.to ?? todayIn(tz)}` : "All dates"],
        ["Type", q.kind ? FINANCE_KIND_LABELS[q.kind] : "Everything"],
        ["Category", q.category ? categoryLabel(q.category) : "All categories"],
        ["Branch", q.branchId ? (names.get(q.branchId) ?? "One branch") : "All branches"],
        ...(q.search ? [["Search", q.search] as [string, string]] : []),
        ["Entries", String(all.data.length)],
      ];
      const lines = await this.parties.linesFor(all.data.map((e) => e.id));
      const body = await buildEntriesWorkbook({
        entries: all.data,
        lines,
        branchName: (id) => (id ? (names.get(id) ?? "Former branch") : ""),
        restaurant: org?.name ?? "Restaurant",
        filters,
        generatedAt: formatDateTime(new Date(), tz),
      });
      return new FileResult(`finance-${q.kind ?? "all"}-${q.from ?? "start"}-to-${q.to ?? todayIn(tz)}.xlsx`, XLSX_MIME, body);
    }
    const page = await this.repo.list(actor.organizationId, scope, q);
    return { data: await this.withParties(page.data), meta: page.meta, sum: page.sum };
  }

  private async assertDate(actor: Actor, date: string): Promise<void> {
    const org = await this.organizations.findById(actor.organizationId);
    if (date > todayIn(org?.timezone ?? "Africa/Lagos")) throw AppError.badRequest("Entries can't be dated in the future");
  }

  private toNew(actor: Actor, b: EntryBody): NewEntry {
    if (b.branchId) assertBranchAccess(actor, b.branchId);
    else if (branchScope(actor) !== null) throw AppError.forbidden("Only someone who works across every branch can record business-wide entries; choose a branch");
    return {
      organizationId: actor.organizationId,
      branchId: b.branchId ?? null,
      kind: b.kind,
      category: b.category,
      title: b.title,
      amount: b.amount,
      entryDate: b.entryDate,
      paymentMethod: b.paymentMethod ?? null,
      party: null,
      reference: b.reference ?? null,
      notes: b.notes ?? null,
      createdBy: actor.id,
      createdByName: actor.name,
    };
  }

  /**
   * Turns each item's `parties` lines (or its single `party` name) into saved-party lines, in one batch: names are
   * found case-insensitively or created, ids are checked to belong to this restaurant, and the shares must add up to
   * the amount. `null` for an item = it didn't mention parties at all (leave them as they are).
   */
  private async resolveParties(actor: Actor, items: Array<{ amount: number; parties?: PartyLineBody[]; party?: string | null }>, tx: Tx): Promise<Array<ResolvedParties | null>> {
    const names: string[] = [];
    const ids: string[] = [];
    for (const it of items) {
      if (it.parties) for (const l of it.parties) l.partyId ? ids.push(l.partyId) : names.push(l.name!);
      else if (it.party) names.push(it.party);
    }
    const byName = await this.parties.findOrCreate(actor.organizationId, names, tx);
    const known = await this.parties.findByIds(actor.organizationId, [...new Set([...ids, ...byName.values()])], tx);
    const nameOf = new Map(known.map((p) => [p.id, p.name]));
    const row = (i: number) => (items.length > 1 ? `Row ${i + 1}: ` : "");
    return items.map((it, i) => {
      const wanted = it.parties ?? (it.party === undefined ? undefined : it.party ? [{ name: it.party, amount: it.amount }] : []);
      if (wanted === undefined) return null;
      const lines = wanted.map((l) => {
        const partyId = l.partyId ?? byName.get(l.name!.trim().toLowerCase());
        if (!partyId || !nameOf.has(partyId)) throw AppError.badRequest(`${row(i)}one of the people on this entry no longer exists; choose again`);
        return { partyId, amount: l.amount };
      });
      const seen = new Set<string>();
      for (const l of lines) {
        if (seen.has(l.partyId)) throw AppError.badRequest(`${row(i)}"${nameOf.get(l.partyId)}" is listed twice; put their amounts on one line`);
        seen.add(l.partyId);
      }
      const sum = lines.reduce((s, l) => s + l.amount, 0);
      if (lines.length && sum !== it.amount) throw AppError.badRequest(`${row(i)}the amounts for each person add up to ${formatMoney(sum)}, but the total is ${formatMoney(it.amount)}`);
      return { lines, names: lines.map((l) => nameOf.get(l.partyId)!) };
    });
  }

  private async withParties(entries: FinanceEntry[]): Promise<FinanceEntryDTO[]> {
    const lines = await this.parties.linesFor(entries.map((e) => e.id));
    return entries.map((e) => toEntryDTO(e, lines.filter((l) => l.entryId === e.id)));
  }

  async create(actor: Actor, b: EntryBody): Promise<FinanceEntryDTO> {
    this.assertMayRecord(actor, b.kind);
    await this.assertDate(actor, b.entryDate);
    const entry = await inTransaction(async (tx) => {
      const [resolved] = await this.resolveParties(actor, [b], tx);
      const saved = await this.repo.create({ ...this.toNew(actor, b), party: joinNames(resolved?.names ?? []) }, tx);
      if (resolved?.lines.length) await this.parties.replaceLines(saved.id, resolved.lines, tx);
      await this.audit.log(actor, { action: "create", entityType: "finance_entry", entityId: saved.id, branchId: saved.branchId, summary: `Recorded ${FINANCE_KIND_LABELS[saved.kind].toLowerCase()} "${saved.title}" (${categoryLabel(saved.category)}, ${saved.amount} kobo, ${saved.entryDate}${saved.party ? `, ${saved.party}` : ""})`, after: b }, tx);
      return saved;
    });
    return (await this.withParties([entry]))[0];
  }

  async importMany(actor: Actor, rows: EntryBody[]): Promise<{ imported: number }> {
    assertPermission(actor, "finance.manage");
    const latest = rows.reduce((m, r) => (r.entryDate > m ? r.entryDate : m), "0000-00-00");
    await this.assertDate(actor, latest);
    const entries = rows.map((r) => this.toNew(actor, r));
    const total = entries.reduce((s, e) => s + e.amount, 0);
    const imported = await inTransaction(async (tx) => {
      const resolved = await this.resolveParties(actor, rows, tx);
      resolved.forEach((r, i) => { entries[i].party = joinNames(r?.names ?? []) });
      const ids = await this.repo.createMany(entries, tx);
      await this.parties.insertLines(ids.flatMap((entryId, i) => (resolved[i]?.lines ?? []).map((l, k) => ({ entryId, partyId: l.partyId, amount: l.amount, sortOrder: k }))), tx);
      await this.audit.log(actor, { action: "import", entityType: "finance_entry", summary: `Imported ${ids.length} finance entries (${total} kobo in total)` }, tx);
      return ids.length;
    });
    return { imported };
  }

  async update(actor: Actor, id: string, b: UpdateEntryBody): Promise<FinanceEntryDTO> {
    const entry = await this.repo.findById(actor.organizationId, id);
    if (!entry) throw AppError.notFound("Entry not found");
    await this.assertMayChange(actor, entry, b.kind);
    if (entry.branchId) assertBranchAccess(actor, entry.branchId);
    else if (branchScope(actor) !== null) throw AppError.forbidden("This is a business-wide entry");
    const kind = b.kind ?? entry.kind;
    const category = b.category ?? entry.category;
    if (categoryOf(category)?.kind !== kind) throw AppError.badRequest("That category does not belong to this kind of entry");
    if (b.branchId) assertBranchAccess(actor, b.branchId);
    if (b.entryDate) await this.assertDate(actor, b.entryDate);
    const amount = b.amount ?? entry.amount;
    const { parties: _lines, party: _party, ...fields } = b;
    await inTransaction(async (tx) => {
      let [resolved] = await this.resolveParties(actor, [{ amount, parties: b.parties, party: b.party }], tx);
      if (!resolved && amount !== entry.amount) {
        // Only the total changed: a single line follows it; a split must be re-entered.
        const current = await this.parties.linesFor([id], tx);
        if (current.length > 1) throw AppError.badRequest("This entry is split between several people: change their amounts too");
        if (current.length === 1) resolved = { lines: [{ partyId: current[0].partyId, amount }], names: [current[0].name] };
      }
      await this.repo.update(actor.organizationId, id, { ...fields, kind, category, ...(resolved ? { party: joinNames(resolved.names) } : {}) }, tx);
      if (resolved) await this.parties.replaceLines(id, resolved.lines, tx);
      await this.audit.log(actor, { action: "update", entityType: "finance_entry", entityId: id, branchId: entry.branchId, summary: `Edited finance entry "${entry.title}"`, before: entry as unknown as Record<string, unknown>, after: b }, tx);
    });
    return (await this.withParties([(await this.repo.findById(actor.organizationId, id))!]))[0];
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const entry = await this.repo.findById(actor.organizationId, id);
    if (!entry) throw AppError.notFound("Entry not found");
    await this.assertMayChange(actor, entry);
    if (entry.branchId) assertBranchAccess(actor, entry.branchId);
    else if (branchScope(actor) !== null) throw AppError.forbidden("This is a business-wide entry");
    await this.repo.softDelete(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "finance_entry", entityId: id, branchId: entry.branchId, summary: `Deleted finance entry "${entry.title}" (${entry.amount} kobo, ${entry.entryDate})`, before: entry as unknown as Record<string, unknown> });
  }

  async budgets(actor: Actor) {
    assertPermission(actor, "finance.view");
    const rows = await this.repo.budgets(actor.organizationId);
    return rows.map((b) => ({ category: b.category, monthlyAmount: b.monthlyAmount }));
  }

  async setBudgets(actor: Actor, rows: BudgetRow[]) {
    assertPermission(actor, "finance.manage");
    await inTransaction(async (tx) => {
      await this.repo.replaceBudgets(actor.organizationId, rows, tx);
      await this.audit.log(actor, { action: "update", entityType: "finance_budget", summary: `Updated monthly budgets (${rows.filter((r) => r.monthlyAmount > 0).length} categories)`, after: Object.fromEntries(rows.map((r) => [r.category, r.monthlyAmount])) }, tx);
    });
    return (await this.repo.budgets(actor.organizationId)).map((b) => ({ category: b.category, monthlyAmount: b.monthlyAmount }));
  }
}
