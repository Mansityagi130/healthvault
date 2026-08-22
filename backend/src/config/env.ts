import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "Must be at least 32 chars").optional(),
  JWT_REFRESH_SECRET: z.string().min(32, "Must be at least 32 chars").optional(),
  JWT_ISSUER: z.string().default("healthvault-auth"),
  JWT_AUDIENCE: z.string().default("healthvault-users"),
  STORAGE_PATH: z.string().default("./storage"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  MFA_ENCRYPTION_KEY: z.string().min(32, "MFA_ENCRYPTION_KEY must be at least 32 characters long").optional(),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  const missingVars = parsedEnvironment.error.issues.map((e: any) => e.path.join('.')).join(', ');
  console.error(`[FATAL] Missing or invalid configuration variables: ${missingVars}`);
  process.exit(1);
}

const config = parsedEnvironment.data;

if (config.NODE_ENV === "production") {
  const missingProd = [];
  if (!config.JWT_ACCESS_SECRET) missingProd.push("JWT_ACCESS_SECRET");
  if (!config.JWT_REFRESH_SECRET) missingProd.push("JWT_REFRESH_SECRET");
  if (!config.MFA_ENCRYPTION_KEY) missingProd.push("MFA_ENCRYPTION_KEY");
  
  if (missingProd.length > 0) {
    console.error(`[FATAL] Missing required production configuration: ${missingProd.join(', ')}`);
    process.exit(1);
  }
} else {
  // Safe fallbacks for local dev only
  config.JWT_ACCESS_SECRET = config.JWT_ACCESS_SECRET || "fallback_access_secret_for_dev_only_32_chars_min";
  config.JWT_REFRESH_SECRET = config.JWT_REFRESH_SECRET || "fallback_refresh_secret_for_dev_only_32_chars_min";
  config.MFA_ENCRYPTION_KEY = config.MFA_ENCRYPTION_KEY || "fallback_mfa_encryption_key_for_dev_only_32_chars_min";
}

export const env = {
  ...config,
  JWT_ACCESS_SECRET: config.JWT_ACCESS_SECRET as string,
  JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET as string,
  MFA_ENCRYPTION_KEY: config.MFA_ENCRYPTION_KEY as string,
};
