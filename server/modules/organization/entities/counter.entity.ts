// Per-restaurant sequences (order numbers). Incremented with UPDATE … RETURNING inside the order transaction.
import { EntitySchema } from "typeorm";
import { bigintNumber } from "../../../infrastructure/database/columns";

export interface Counter {
  organizationId: string;
  key: string;
  value: number;
}

export const CounterEntity = new EntitySchema<Counter>({
  name: "Counter",
  tableName: "counters",
  columns: {
    organizationId: { type: "uuid", name: "organization_id", primary: true },
    key: { type: "varchar", name: "key", length: 40, primary: true },
    value: { type: "bigint", name: "value", default: 0, transformer: bigintNumber },
  },
});
