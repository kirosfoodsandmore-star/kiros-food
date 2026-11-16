import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, floatColumn, manyToOne, primaryId, textColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Address {
  id: string;
  organizationId: string;
  customerId: string;
  label: string | null;
  line: string;
  lat: number | null;
  lng: number | null;
  instructions: string | null;
  isDefault: boolean;
  createdAt: Date;
  deletedAt: Date | null;
  customer?: { id: string };
}

export const AddressEntity = new EntitySchema<Address>({
  name: "Address",
  tableName: "addresses",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    customerId: uuidColumn("customer_id"),
    label: varchar("label", 40, true),
    line: textColumn("line", false),
    lat: floatColumn("lat"),
    lng: floatColumn("lng"),
    instructions: varchar("instructions", 255, true),
    isDefault: boolColumn("is_default", false),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  relations: { customer: manyToOne("Customer", "customer_id", "CASCADE") },
  indices: [{ name: "IDX_addresses_customer", columns: ["customerId"] }],
});
