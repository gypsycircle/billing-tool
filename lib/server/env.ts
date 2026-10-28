// lib/server/env.ts
// The only place server configuration is read from process.env.
// Validated once (at boot via instrumentation.ts, or on first use) and cached.
// Errors name the variable that is wrong — never its value.
//
// Exception: lib/server/session/token.ts reads SESSION_SECRET directly because
// proxy.ts imports it and must stay free of `server-only`.

import "server-only";

import { z } from "zod";

const envSchema = z.object({
  // Signs session cookies. (The access code itself is stored hashed in the database.)
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),

  // MongoDB Atlas — the bookings database
  MONGODB_URI: z
    .string()
    .trim()
    .refine((uri) => /^mongodb(\+srv)?:\/\//.test(uri), "must be a mongodb:// or mongodb+srv:// connection string"),
  MONGODB_DB: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,63}$/, "must be a database name (letters, digits, _ and -)")
    .default("gypsycircle_billing"),

  // Invoice numbering — the counter each year starts at (INV_{year}0143)
  INITIAL_INVOICE_NUMBER: z.coerce.number().int().positive("must be a positive whole number"),

  // The app's public origin — mutating requests must come from it.
  // Required in production; development falls back to the request's own origin.
  APP_URL: z.url("must be a full URL such as https://billing.example.com").optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === "production" && !env.APP_URL) {
    ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "is required in production" });
  }
});

type Env = z.infer<typeof envSchema>;

export class EnvConfigError extends Error {
  constructor(readonly variables: string[]) {
    super(`Invalid server configuration: ${variables.join(", ")}`);
    this.name = "EnvConfigError";
  }
}

let cached: Env | undefined;

/** Returns validated configuration; throws EnvConfigError naming the bad variables. */
export function getEnv(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const variables = result.error.issues.map(
      (issue) => `${String(issue.path[0])} (${issue.message})`
    );
    throw new EnvConfigError(variables);
  }

  cached = result.data;
  return cached;
}
