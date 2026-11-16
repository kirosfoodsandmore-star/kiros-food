// Opening windows per weekday. A day may have several rows (split shifts). Open/Closed is computed.
import { EntitySchema } from "typeorm";
import { intColumn, manyToOne, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface OpeningHour {
  id: string;
  branchId: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** HH:MM local time */
  opensAt: string;
  /** HH:MM local time; "24:00" or earlier than opensAt means past midnight. */
  closesAt: string;
  branch?: { id: string };
}

export const OpeningHourEntity = new EntitySchema<OpeningHour>({
  name: "OpeningHour",
  tableName: "opening_hours",
  columns: {
    id: primaryId(),
    branchId: uuidColumn("branch_id"),
    weekday: intColumn("weekday", 0),
    opensAt: varchar("opens_at", 5),
    closesAt: varchar("closes_at", 5),
  },
  relations: { branch: manyToOne("Branch", "branch_id", "CASCADE") },
  indices: [{ name: "IDX_opening_hours_branch", columns: ["branchId", "weekday"] }],
});
