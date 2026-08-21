import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { databaseClient } from "../config/database.js";
const prisma = databaseClient.getClient();
import { z } from "zod";
import crypto from "crypto";

const generateTokenSchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(60).default(15)
}).strict();

const consumeTokenSchema = z.object({
  selector: z.string().uuid(),
  token: z.string().min(32).max(128)
}).strict();

export class HospitalRegistrationController {
  
  static async generateRegistrationToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const data = generateTokenSchema.parse(req.body);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: user.id }
      });
      if (!patientProfile) {
        res.status(404).json({ error: "Patient profile not found" });
        return;
      }

      const selector = crypto.randomUUID();
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + data.expiresInMinutes * 60 * 1000);

      const tokenData = await prisma.registrationPairingToken.create({
        data: {
          patientId: patientProfile.id,
          selector,
          tokenHash,
          expiresAt
        }
      });

      res.status(201).json({
        selector: tokenData.selector,
        token: rawToken,
        expiresAt: tokenData.expiresAt
      });
    } catch (err: any) {
      if (err.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: err.errors });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  static async consumeRegistrationToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const data = consumeTokenSchema.parse(req.body);

      // Verify the staff belongs to this hospital and has HOSPITAL_STAFF or ADMIN role
      // For this prototype, if they are calling this endpoint they must be authenticated and
      // the route uses middleware that checks the membership, but we verify here for safety.
      const membership = await prisma.hospitalMembership.findFirst({
        where: {
          userId: req.user!.id,
          hospitalId,
          status: "ACTIVE",
          role: { in: ["HOSPITAL_ADMIN", "STAFF"] }
        }
      });

      if (!membership) {
        res.status(403).json({ error: "Unauthorized: Active hospital staff membership required" });
        return;
      }

      const patient = await prisma.$transaction(async (tx) => {
        const tokenHash = crypto.createHash("sha256").update(data.token).digest("hex");
        
        const tokenData = await tx.registrationPairingToken.findUnique({
          where: { selector: data.selector },
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                sexAtBirth: true
              }
            }
          }
        });

        if (!tokenData || tokenData.tokenHash !== tokenHash) {
          throw new Error("Invalid or expired pairing token");
        }

        await tx.registrationPairingToken.delete({
          where: { selector: data.selector }
        });

        if (tokenData.expiresAt < new Date()) {
          throw new Error("Pairing token has expired");
        }

        return tokenData.patient;
      });

      // Minimal patient identity is returned. The hospital desk can now invoke createEncounter.
      res.status(200).json({
        message: "Registration successful. You may now create an encounter.",
        patient
      });

    } catch (err: any) {
      if (err.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: err.errors });
      } else if (err.message.startsWith("Invalid") || err.message.startsWith("Pairing")) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}
