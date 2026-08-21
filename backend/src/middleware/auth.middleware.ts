import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    sessionId: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.split(" ")[1] as string;
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as unknown as { sub: string; sessionId: string; type: string };

    if (decoded.type !== "access") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = {
      id: decoded.sub,
      sessionId: decoded.sessionId,
    };
    next();
  } catch (_error: unknown) {
    res.status(401).json({ error: "Unauthorized" });
  }
};
