// Dates a branch is closed regardless of opening hours.
import { EntitySchema } from "typeorm";
import { dateColumn, manyToOne, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface HolidayClosure {
  id: string;
  branchId: string;
  date: string;
  reason: string | null;
  branch?: { id: string };
}

export const HolidayClosureEntity = new EntitySchema<HolidayClosure>({
  name: "HolidayClosure",
  tableName: "holiday_closures",
  columns: {
    id: primaryId(),
    branchId: uuidColumn("branch_id"),
    date: dateColumn("date"),
    reason: varchar("reason", 160, true),
  },
  relations: { branch: manyToOne("Branch", "branch_id", "CASCADE") },
  indices: [{ name: "UQ_holiday_closures_branch_date", columns: ["branchId", "date"], unique: true }],
});
