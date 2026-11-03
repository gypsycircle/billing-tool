// lib/domain/login.schema.ts
// What the access page sends to sign in: the access code.

import { z } from "zod";

export const loginSchema = z.object({
  code: z.string({ error: "Access code is required." }).min(1, "Access code is required.").max(256, "Access code is too long."),
});
