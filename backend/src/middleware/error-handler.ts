import type { ErrorRequestHandler } from "express";
import { requestContext, logger } from "../utils/logger.js";
import { env } from "../config/env.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const context = requestContext.getStore();
  const requestId = context?.requestId || _request.id || "unknown";

  const isProd = env.NODE_ENV === "production";
  
  // Safely grab error properties
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = error.status || error.statusCode || 500;
  
  // Try to determine a reasonable standard code if one isn't provided
  let code = error.code || "INTERNAL_ERROR";
  if (!error.code) {
    if (status === 400) code = "VALIDATION_ERROR";
    else if (status === 401) code = "AUTHENTICATION_ERROR";
    else if (status === 403) code = "AUTHORIZATION_ERROR";
    else if (status === 404) code = "NOT_FOUND";
    else if (status === 409) code = "CONFLICT";
    else if (status === 429) code = "RATE_LIMITED";
    else if (status === 503) code = "DEPENDENCY_UNAVAILABLE";
  }

  // Hide detailed message for 500s in prod
  const clientMessage = (status === 500 && isProd) ? "Internal server error" : message;

  logger.error("Request failed", { 
    error: error.message, 
    stack: error.stack, 
    code,
    status
  });

  response.status(status).json({
    code,
    message: clientMessage,
    requestId,
    // Provide stack trace in dev/test only if it's a 500, though for tests maybe not needed.
    ...( (!isProd && status === 500) ? { stack: error.stack } : {} )
  });
};
