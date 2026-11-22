import { EntitySchema } from "typeorm";
import { createdAt, deletedAt, intColumn, manyToOne, moneyColumn, primaryId, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

/** A saved vendor, customer, investor or lender: anyone the business pays or is paid by. */
export interface FinanceParty {
  id: string;
  organizationId: string;
  name: string;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const FinancePartyEntity = new EntitySchema<FinanceParty>({
  name: "FinanceParty",
  tableName: "finance_parties",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 160),
    phone: varchar("phone", 40, true),
    notes: varchar("notes", 500, true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
});

/** One party's share of an entry. The entry's amount is the sum of its lines. */
export interface FinanceEntryParty {
  id: string;
  entryId: string;
  partyId: string;
  amount: number;
  sortOrder: number;
}

export const FinanceEntryPartyEntity = new EntitySchema<FinanceEntryParty>({
  name: "FinanceEntryParty",
  tableName: "finance_entry_parties",
  columns: {
    id: primaryId(),
    entryId: uuidColumn("entry_id"),
    partyId: uuidColumn("party_id"),
    amount: moneyColumn("amount"),
    sortOrder: intColumn("sort_order", 0),
  },
});
