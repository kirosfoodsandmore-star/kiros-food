// Emailed 6-digit password reset codes for staff. Only the keyed hash is stored; 5 attempts max.
import { EntitySchema } from "typeorm";
import { createdAt, intColumn, manyToOne, primaryId, timestampColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface PasswordReset {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
  user?: { id: string };
}

export const PasswordResetEntity = new EntitySchema<PasswordReset>({
  name: "PasswordReset",
  tableName: "password_resets",
  columns: {
    id: primaryId(),
    userId: uuidColumn("user_id"),
    codeHash: varchar("code_hash", 64),
    expiresAt: timestampColumn("expires_at", false),
    attempts: intColumn("attempts", 0),
    usedAt: timestampColumn("used_at"),
    createdAt: createdAt(),
  },
  relations: { user: manyToOne("User", "user_id", "CASCADE") },
  indices: [{ name: "IDX_password_resets_user", columns: ["userId", "createdAt"] }],
});
