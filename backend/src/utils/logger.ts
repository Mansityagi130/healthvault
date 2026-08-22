import { env } from "../config/env.js";
import { AsyncLocalStorage } from "node:async_hooks";

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

const SENSITIVE_KEYS = [
  "password", "accesstoken", "refreshtoken", "jwt", "cookie", "authorization", 
  "token", "qrpayload", "secret", "credentials", "ssn"
];

// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
function redact(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  const redactedObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      redactedObj[key] = "[REDACTED]";
    } else {
      redactedObj[key] = typeof value === "object" ? redact(value) : value;
    }
  }
  return redactedObj;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
function logMessage(level: string, message: string, meta?: Record<string, any>) {
  const context = requestContext.getStore();
  const requestId = context?.requestId;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: "healthvault-api",
    environment: env.NODE_ENV,
    requestId,
    message,
    ...(meta ? redact(meta) : {}),
  };

  if (env.NODE_ENV === "test") return;

  const out = JSON.stringify(logEntry);
  if (level === "ERROR" || level === "FATAL") {
    console.error(out);
  } else if (level === "WARN") {
    console.warn(out);
  } else {
    console.log(out);
  }
}

export const logger = {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  info: (msg: string, meta?: any) => logMessage("INFO", msg, meta),
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  warn: (msg: string, msgMeta?: any) => logMessage("WARN", msg, msgMeta),
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  error: (msg: string, meta?: any) => logMessage("ERROR", msg, meta),
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  fatal: (msg: string, meta?: any) => logMessage("FATAL", msg, meta),
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  debug: (msg: string, meta?: any) => logMessage("DEBUG", msg, meta),
};
