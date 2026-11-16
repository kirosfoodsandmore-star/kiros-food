import { z } from "zod";

export const pushTokenSchema = z.object({ body: z.object({ token: z.string().trim().min(20).max(4096) }) });
