import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    console.info(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
  });

  next();
};
