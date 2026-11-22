import { z } from "zod";
import { REPORT_GROUPINGS } from "../../../config/constants";
import { dateRangeQuery, uuid } from "../../../shared/validation/common";

export const salesReportSchema = z.object({
  query: z.object({
    ...dateRangeQuery,
    groupBy: z.enum(REPORT_GROUPINGS).default("day"),
    branchId: uuid.optional(),
    format: z.enum(["json", "csv", "xlsx"]).default("json"),
  }),
});

export const dashboardSchema = z.object({ query: z.object({ branchId: uuid.optional() }) });

export type SalesReportQuery = z.infer<typeof salesReportSchema>["query"];
