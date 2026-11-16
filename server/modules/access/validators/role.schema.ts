import { z } from "zod";
import { idParams, optionalText, requiredText } from "../../../shared/validation/common";
import { isPermissionCode } from "../catalog/permissions.catalog";

const permissionList = z
  .array(z.string().trim().refine(isPermissionCode, "Unknown permission"))
  .max(100)
  .transform((codes) => [...new Set(codes)]);

export const createRoleSchema = z.object({
  body: z.object({
    name: requiredText(80),
    description: optionalText(300),
    permissions: permissionList,
  }),
});

export const updateRoleSchema = z.object({
  params: idParams,
  body: z
    .object({
      name: requiredText(80),
      description: optionalText(300),
      permissions: permissionList,
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const roleIdSchema = z.object({ params: idParams });

export type CreateRoleInput = z.infer<typeof createRoleSchema>["body"];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>["body"];
