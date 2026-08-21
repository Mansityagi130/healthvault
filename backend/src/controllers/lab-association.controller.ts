import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { databaseClient } from "../config/database.js";
const prisma = databaseClient.getClient();
import { 
  generateLabPairingTokenSchema, 
  consumeLabPairingTokenSchema,
  approveLabAssociationSchema,
  revokeLabAssociationSchema
} from "../schemas/lab-association.schema.js";
import { 
  AssociationStatus,
  AuditAction,
  MembershipStatus,
  MembershipRole,
  NotificationType
} from "../generated/prisma/enums.js";
import { notificationService } from "../services/notification.service.js";
import crypto from "crypto";

async function verifyLabMembership(userId: string, labId: string) {
  const membership = await prisma.labMembership.findUnique({
    where: {
      labId_userId: {
        labId,
        userId
      }
    }
  });

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new Error("Unauthorized: Active Lab Membership required");
  }

  if (membership.role !== MembershipRole.LAB_USER && membership.role !== MembershipRole.LAB_ADMIN) {
    throw new Error("Unauthorized: Requires LAB_USER or LAB_ADMIN role");
  }

  return membership;
}

export const LabAssociationController = {
  // ---------------------------------------------------------------------------
  // PATIENT ENDPOINTS
  // ---------------------------------------------------------------------------

  // 1. Patient generates a pairing token
  async generatePairingToken(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const data = generateLabPairingTokenSchema.parse(req.body);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: user.id }
      });
      if (!patientProfile) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const selector = crypto.randomUUID();
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + data.expiresInMinutes * 60 * 1000);

      const tokenData = await prisma.labPairingToken.create({
        data: {
          patientId: patientProfile.id,
          selector,
          tokenHash,
          expiresAt
        }
      });

      // DO NOT return the tokenHash, only the raw token and selector
      res.status(201).json({
        selector: tokenData.selector,
        token: rawToken,
        expiresAt: tokenData.expiresAt
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  },

  // 2. Patient lists their associations
  async listPatientAssociations(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: user.id }
      });
      if (!patientProfile) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const associations = await prisma.patientLabAssociation.findMany({
        where: { patientId: patientProfile.id },
        include: {
          lab: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      res.status(200).json({ items: associations });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // 3. Patient approves a PENDING association
  async approveAssociation(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const data = approveLabAssociationSchema.parse(req.body);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: user.id }
      });
      if (!patientProfile) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      // Check for concurrent approvals
      const association = await prisma.$transaction(async (tx) => {
        const assoc = await tx.patientLabAssociation.findUnique({
          where: { id: data.associationId }
        });

        if (!assoc || assoc.patientId !== patientProfile.id) {
          throw new Error("Association not found");
        }

        if (assoc.status !== AssociationStatus.PENDING) {
          throw new Error("Only PENDING associations can be approved");
        }

        // Enforce uniqueness for ACTIVE associations per Lab
        // Ensure no other active exists
        const existingActive = await tx.patientLabAssociation.findFirst({
          where: {
            patientId: patientProfile.id,
            labId: assoc.labId,
            status: AssociationStatus.ACTIVE
          }
        });

        if (existingActive) {
          throw new Error("An ACTIVE association with this lab already exists");
        }

        const updated = await tx.patientLabAssociation.update({
          where: { id: assoc.id },
          data: { status: AssociationStatus.ACTIVE }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: AuditAction.LAB_ASSOCIATION_APPROVED,
            targetType: "PatientLabAssociation",
            targetId: assoc.id
          }
        });

        const labAdmins = await tx.labMembership.findMany({
          where: { labId: assoc.labId, status: "ACTIVE" }
        });
        
        for (const admin of labAdmins) {
          await notificationService.createNotification({
            userId: admin.userId,
            type: NotificationType.LAB_ASSOCIATION_APPROVED,
            title: "Patient Association Approved",
            message: "A patient has approved their laboratory association.",
            relatedResource: { type: "PatientLabAssociation", id: assoc.id }
          });
        }

        return updated;
      });

      res.status(200).json(association);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else if (error.message.startsWith("Association not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  },

  // 4. Patient revokes an association (PENDING or ACTIVE)
  async revokeAssociation(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const data = revokeLabAssociationSchema.parse(req.body);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: user.id }
      });
      if (!patientProfile) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const association = await prisma.$transaction(async (tx) => {
        const assoc = await tx.patientLabAssociation.findUnique({
          where: { id: data.associationId }
        });

        if (!assoc || assoc.patientId !== patientProfile.id) {
          throw new Error("Association not found");
        }

        if (assoc.status === AssociationStatus.REVOKED) {
          return assoc;
        }

        const updated = await tx.patientLabAssociation.update({
          where: { id: assoc.id },
          data: { 
            status: AssociationStatus.REVOKED,
            revokedAt: new Date()
          }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: AuditAction.LAB_ASSOCIATION_REVOKED,
            targetType: "PatientLabAssociation",
            targetId: assoc.id
          }
        });

        const labAdmins = await tx.labMembership.findMany({
          where: { labId: assoc.labId, status: "ACTIVE" }
        });
        
        for (const admin of labAdmins) {
          await notificationService.createNotification({
            userId: admin.userId,
            type: NotificationType.LAB_ASSOCIATION_REVOKED,
            title: "Patient Association Revoked",
            message: "A patient has revoked their laboratory association.",
            relatedResource: { type: "PatientLabAssociation", id: assoc.id }
          });
        }

        return updated;
      });

      res.status(200).json(association);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else if (error.message.startsWith("Association not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  },

  // ---------------------------------------------------------------------------
  // LAB ENDPOINTS
  // ---------------------------------------------------------------------------

  // 5. Lab consumes the pairing token to create PENDING association
  async consumePairingToken(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const labId = req.params.labId as string;
      const data = consumeLabPairingTokenSchema.parse(req.body);

      await verifyLabMembership(user.id, labId);

      const result = await prisma.$transaction(async (tx) => {
        const tokenHash = crypto.createHash("sha256").update(data.token).digest("hex");
        
        // Single-use guarantee: Find and immediately delete
        const tokenData = await tx.labPairingToken.findUnique({
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

        // Delete so it cannot be re-used
        await tx.labPairingToken.delete({
          where: { selector: data.selector }
        });

        if (tokenData.expiresAt < new Date()) {
          throw new Error("Pairing token has expired");
        }

        // Check if an existing ACTIVE or PENDING association exists
        let association = await tx.patientLabAssociation.findUnique({
          where: {
            patientId_labId: {
              patientId: tokenData.patientId,
              labId: labId
            }
          }
        });

        if (association) {
          if (association.status === AssociationStatus.ACTIVE) {
            throw new Error("Patient is already associated with this lab");
          }
          if (association.status === AssociationStatus.PENDING) {
            // Already pending, just return the minimal info
            return { association, patient: tokenData.patient };
          }
          // If REVOKED or EXPIRED, we update it to PENDING for re-approval
          association = await tx.patientLabAssociation.update({
            where: { id: association.id },
            data: { 
              status: AssociationStatus.PENDING,
              revokedAt: null
            }
          });
        } else {
          // Create new PENDING association
          association = await tx.patientLabAssociation.create({
            data: {
              patientId: tokenData.patientId,
              labId: labId,
              status: AssociationStatus.PENDING
            }
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: AuditAction.LAB_ASSOCIATION_QR_RESOLVED,
            targetType: "PatientLabAssociation",
            targetId: association.id
          }
        });

        return { association, patient: tokenData.patient };
      });

      res.status(200).json({
        message: "Pairing successful. Waiting for patient approval.",
        associationId: result.association.id,
        patient: result.patient
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else if (error.message.startsWith("Unauthorized")) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  },

  // 6. Lab lists its associated patients (only ACTIVE)
  async listLabAssociations(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const labId = req.params.labId as string;

      await verifyLabMembership(user.id, labId);

      const associations = await prisma.patientLabAssociation.findMany({
        where: {
          labId,
          status: AssociationStatus.ACTIVE
        },
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
        },
        orderBy: { createdAt: "desc" }
      });

      res.status(200).json({ items: associations });
    } catch (error: any) {
      if (error.message.startsWith("Unauthorized")) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
};
