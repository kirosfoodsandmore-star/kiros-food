// Sales reports grouped by day, branch, menu, item or option, with CSV export.
import { assertPermission } from "../../../shared/access/can";
import { branchScope } from "../../../shared/access/scope";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { toCsv } from "../../../shared/utils/csv";
import { resolveRange } from "../../../shared/utils/dates";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { ReportRepository, type SalesRow, type SalesScope } from "../repositories/report.repository";
import type { SalesReportQuery } from "../validators/report.schema";

export class ReportService {
  static Instance = new ReportService();
  private constructor(
    private readonly repo = ReportRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance
  ) {}

  async scope(actor: Actor, branchId?: string, from?: string, to?: string): Promise<SalesScope> {
    const org = await this.organizations.findById(actor.organizationId);
    const timezone = org?.timezone ?? "Africa/Lagos";
    const range = resolveRange(timezone, from, to);
    return { organizationId: actor.organizationId, branchIds: branchScope(actor, branchId), from: range.from, to: range.to, timezone };
  }

  async sales(actor: Actor, q: SalesReportQuery) {
    const scope = await this.scope(actor, q.branchId, q.from, q.to);
    const rows = await this.rowsFor(q.groupBy, scope);
    const totals = await this.repo.totals(scope);
    if (q.format === "csv") {
      assertPermission(actor, "reports.export");
      const csv = toCsv<SalesRow>(rows, [
        { header: q.groupBy[0].toUpperCase() + q.groupBy.slice(1), value: (r) => r.label },
        { header: "Orders", value: (r) => r.orders },
        { header: "Items", value: (r) => r.items },
        { header: "Subtotal (kobo)", value: (r) => r.subtotal },
        { header: "Delivery fees (kobo)", value: (r) => r.deliveryFees },
        { header: "Discounts (kobo)", value: (r) => r.discounts },
        { header: "Revenue (kobo)", value: (r) => r.revenue },
      ]);
      return new FileResult(`sales-by-${q.groupBy}-${scope.from}-to-${scope.to}.csv`, "text/csv; charset=utf-8", csv);
    }
    return { groupBy: q.groupBy, from: scope.from, to: scope.to, timezone: scope.timezone, totals, rows };
  }

  private rowsFor(groupBy: SalesReportQuery["groupBy"], scope: SalesScope): Promise<SalesRow[]> {
    switch (groupBy) {
      case "branch":
        return this.repo.byBranch(scope);
      case "menu":
        return this.repo.byMenu(scope);
      case "item":
        return this.repo.byItem(scope);
      case "option":
        return this.repo.byOption(scope);
      default:
        return this.repo.byDay(scope);
    }
  }
}
