import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_ISSUER: z.string().default("healthvault-auth"),
  JWT_AUDIENCE: z.string().default("healthvault-users"),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnvironment.error.message}`);
}

const config = parsedEnvironment.data;

if (config.NODE_ENV === "production") {
  if (!config.JWT_ACCESS_SECRET || !config.JWT_REFRESH_SECRET) {
    throw new Error("CRITICAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be provided in production.");
  }
} else {
  // Safe fallbacks for local dev only
  config.JWT_ACCESS_SECRET = config.JWT_ACCESS_SECRET || "fallback_access_secret_for_dev_only";
  config.JWT_REFRESH_SECRET = config.JWT_REFRESH_SECRET || "fallback_refresh_secret_for_dev_only";
}

// We assert the types here since we've populated them if missing in dev
export const env = {
  ...config,
  JWT_ACCESS_SECRET: config.JWT_ACCESS_SECRET as string,
  JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET as string,
};
