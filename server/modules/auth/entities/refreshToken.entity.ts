// Refresh tokens for staff ("staff") and customers ("customer"). Only the keyed hash is stored.
import { EntitySchema } from "typeorm";
import { createdAt, primaryId, timestampColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export type TokenSubject = "staff" | "customer";

export interface RefreshToken {
  id: string;
  subjectType: TokenSubject;
  subjectId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
}

export const RefreshTokenEntity = new EntitySchema<RefreshToken>({
  name: "RefreshToken",
  tableName: "refresh_tokens",
  columns: {
    id: primaryId(),
    subjectType: varchar("subject_type", 10),
    subjectId: uuidColumn("subject_id"),
    tokenHash: varchar("token_hash", 64),
    expiresAt: timestampColumn("expires_at", false),
    revokedAt: timestampColumn("revoked_at"),
    userAgent: varchar("user_agent", 255, true),
    ip: varchar("ip", 64, true),
    createdAt: createdAt(),
  },
  indices: [
    { name: "UQ_refresh_tokens_hash", columns: ["tokenHash"], unique: true },
    { name: "IDX_refresh_tokens_subject", columns: ["subjectType", "subjectId"] },
  ],
});
