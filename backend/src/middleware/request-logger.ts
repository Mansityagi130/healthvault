import type { RequestHandler } from "express";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
import { logger, requestContext } from "../utils/logger.js";
import { metrics } from "../utils/metrics.js";

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();
  metrics.incrementRequest();

  response.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    metrics.recordDuration(durationMs);
    metrics.incrementStatus(response.statusCode);
    
    // Skip noisy health checks in normal logs unless they fail
    if (request.originalUrl.startsWith("/health") && response.statusCode === 200) {
      return;
    }

    const level = response.statusCode >= 500 ? "ERROR" : (response.statusCode >= 400 ? "WARN" : "INFO");
    logger[level === "ERROR" ? "error" : level === "WARN" ? "warn" : "info"](
      `${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`,
      {
        method: request.method,
        route: request.originalUrl,
        status: response.statusCode,
        duration_ms: durationMs,
      }
    );
  });

  next();
};
