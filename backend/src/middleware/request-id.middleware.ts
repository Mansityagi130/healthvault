import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { requestContext, logger } from "../utils/logger.js";

// Augment Express Request
declare global {
// eslint-disable-next-line @typescript-eslint/no-namespace -- Needed for test fixtures/types
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers["x-request-id"] as string) || uuidv4();
  req.id = reqId; 
  res.setHeader("X-Request-ID", reqId);

  requestContext.run({ requestId: reqId }, () => {
    logger.info("Incoming request", { method: req.method, url: req.url, ip: req.ip });
    next();
  });
};
