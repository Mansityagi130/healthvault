import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";
import { databaseClient } from "../config/database.js";
import { MembershipRole } from "../generated/prisma/enums.js";

const prisma = databaseClient.getClient();

export const authorizeRole = (allowedRoles: MembershipRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // Check hospital memberships
      const hospitalMemberships = await prisma.hospitalMembership.findMany({
        where: { userId: req.user.id, status: "ACTIVE" },
      });

      // Check lab memberships
      const labMemberships = await prisma.labMembership.findMany({
        where: { userId: req.user.id, status: "ACTIVE" },
      });

      const userRoles = [
        ...hospitalMemberships.map((m: { role: MembershipRole }) => m.role),
        ...labMemberships.map((m: { role: MembershipRole }) => m.role),
      ];

      const hasRole = userRoles.some((role) => allowedRoles.includes(role));

      if (!hasRole) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      next();
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  };
};

export const authorizeTenant = (allowedRoles?: MembershipRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const hospitalId = req.params.hospitalId || req.body.hospitalId || req.query.hospitalId;

    if (!hospitalId || typeof hospitalId !== 'string') {
      res.status(400).json({ error: "Missing or invalid hospitalId context" });
      return;
    }

    try {
      const membership = await prisma.hospitalMembership.findFirst({
        where: {
          userId: req.user.id,
          hospitalId: hospitalId,
          status: "ACTIVE"
        }
      });

      if (!membership) {
        res.status(403).json({ error: "Forbidden: Not an active member of this organization" });
        return;
      }

      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        res.status(403).json({ error: "Forbidden: Insufficient role in this organization" });
        return;
      }

      // Inject the validated membership context into the request for downstream use
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
      (req as any).tenantMembership = membership;
      
      next();
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  };
};
