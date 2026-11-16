import { actorOf, handle, input } from "../../../shared/http/handler";
import { DashboardService } from "../services/dashboard.service";
import { ReportService } from "../services/report.service";
import { dashboardSchema, salesReportSchema } from "../validators/report.schema";

export class ReportController {
  static sales = handle("Sales report", (req) => ReportService.Instance.sales(actorOf(req), input(req, salesReportSchema).query));
  static dashboard = handle("Dashboard", (req) => DashboardService.Instance.overview(actorOf(req), input(req, dashboardSchema).query.branchId));
}
