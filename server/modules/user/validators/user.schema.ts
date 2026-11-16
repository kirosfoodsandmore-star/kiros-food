import { z } from "zod";
import { PASSWORD_RULE } from "../../../shared/utils/password";
import { email, idParams, pageQuery, phone, queryBool, requiredText, uuid } from "../../../shared/validation/common";

const branchAssignment = {
  branchIds: z.array(uuid).max(100).default([]),
  allBranches: z.boolean().default(false),
};

export const listStaffSchema = z.object({
  query: z.object({
    ...pageQuery,
    roleId: uuid.optional(),
    branchId: uuid.optional(),
    isActive: queryBool.optional(),
  }),
});

export const inviteStaffSchema = z.object({
  body: z
    .object({
      name: requiredText(120),
      email,
      roleId: uuid,
      ...branchAssignment,
    })
    .refine((b) => b.allBranches || b.branchIds.length > 0, { message: "Choose at least one branch or all branches", path: ["branchIds"] }),
});

export const updateStaffSchema = z.object({
  params: idParams,
  body: z
    .object({
      name: requiredText(120),
      phone: phone.optional().nullable(),
      roleId: uuid,
      ...branchAssignment,
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const staffIdSchema = z.object({ params: idParams });

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(16).max(200),
    password: z.string().regex(PASSWORD_RULE, "Password must be 8–72 characters and include a letter and a number"),
    name: requiredText(120).optional(),
    phone: phone.optional().nullable(),
  }),
});

export const inviteTokenSchema = z.object({ params: z.object({ token: z.string().min(16).max(200) }) });

export const transferOwnershipSchema = z.object({
  body: z.object({ userId: uuid, password: z.string().min(1).max(200) }),
});

export type ListStaffQuery = z.infer<typeof listStaffSchema>["query"];
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>["body"];
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>["body"];
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>["body"];
