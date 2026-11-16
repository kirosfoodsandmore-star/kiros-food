// Which menus a branch serves (a branch can serve several; a menu can be served by several branches).
import { EntitySchema } from "typeorm";
import { intColumn } from "../../../infrastructure/database/columns";

export interface BranchMenu {
  branchId: string;
  menuId: string;
  sortOrder: number;
}

export const BranchMenuEntity = new EntitySchema<BranchMenu>({
  name: "BranchMenu",
  tableName: "branch_menus",
  columns: {
    branchId: { type: "uuid", name: "branch_id", primary: true },
    menuId: { type: "uuid", name: "menu_id", primary: true },
    sortOrder: intColumn("sort_order", 0),
  },
  indices: [{ name: "IDX_branch_menus_menu", columns: ["menuId"] }],
});
