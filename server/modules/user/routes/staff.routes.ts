import { Router } from "express";
import { requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { StaffController } from "../controllers/staff.controller";
import { inviteStaffSchema, listStaffSchema, staffIdSchema, transferOwnershipSchema, updateStaffSchema } from "../validators/user.schema";

/** /api/v1/admin/staff */
const router = Router();

router.get("/", authMiddleware, requirePermission("staff.view"), validate(listStaffSchema), StaffController.list);
router.get("/invites", authMiddleware, requirePermission("staff.manage"), StaffController.invites);
router.post("/invite", authMiddleware, requirePermission("staff.manage"), validate(inviteStaffSchema), StaffController.invite);
router.post("/invites/:id/resend", authMiddleware, requirePermission("staff.manage"), validate(staffIdSchema), StaffController.resendInvite);
router.delete("/invites/:id", authMiddleware, requirePermission("staff.manage"), validate(staffIdSchema), StaffController.revokeInvite);
router.post("/transfer-ownership", authMiddleware, requirePermission("staff.manage"), validate(transferOwnershipSchema), StaffController.transferOwnership);
router.get("/:id", authMiddleware, requirePermission("staff.view"), validate(staffIdSchema), StaffController.get);
router.put("/:id", authMiddleware, requirePermission("staff.manage"), validate(updateStaffSchema), StaffController.update);
router.post("/:id/deactivate", authMiddleware, requirePermission("staff.manage"), validate(staffIdSchema), StaffController.deactivate);
router.post("/:id/activate", authMiddleware, requirePermission("staff.manage"), validate(staffIdSchema), StaffController.activate);

export default router;
