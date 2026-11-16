import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { StaffService } from "../services/staff.service";
import { inviteStaffSchema, listStaffSchema, staffIdSchema, transferOwnershipSchema, updateStaffSchema } from "../validators/user.schema";

export class StaffController {
  static list = handle("Staff fetched", async (req) => Paged.of(await StaffService.Instance.list(actorOf(req), input(req, listStaffSchema).query)));
  static get = handle("Staff member fetched", (req) => StaffService.Instance.get(actorOf(req), input(req, staffIdSchema).params.id));
  static invites = handle("Invitations fetched", (req) => StaffService.Instance.listInvites(actorOf(req)));
  static invite = handle("Invitation sent", (req) => StaffService.Instance.invite(actorOf(req), input(req, inviteStaffSchema).body), 201);
  static resendInvite = handle("Invitation resent", (req) => StaffService.Instance.resendInvite(actorOf(req), input(req, staffIdSchema).params.id));
  static revokeInvite = handle("Invitation revoked", (req) => StaffService.Instance.revokeInvite(actorOf(req), input(req, staffIdSchema).params.id));
  static update = handle("Staff member updated", (req) => {
    const { params, body } = input(req, updateStaffSchema);
    return StaffService.Instance.update(actorOf(req), params.id, body);
  });
  static deactivate = handle("Staff member deactivated", (req) => StaffService.Instance.setActive(actorOf(req), input(req, staffIdSchema).params.id, false));
  static activate = handle("Staff member reactivated", (req) => StaffService.Instance.setActive(actorOf(req), input(req, staffIdSchema).params.id, true));
  static transferOwnership = handle("Ownership transferred", (req) => {
    const { userId, password } = input(req, transferOwnershipSchema).body;
    return StaffService.Instance.transferOwnership(actorOf(req), userId, password);
  });
}
