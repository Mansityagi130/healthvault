import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { databaseClient } from "../config/database.js";
import { RecordCategory, RecordSource, ProvenanceStatus, EncounterStatus } from "../generated/prisma/client.js";

const prisma = databaseClient.getClient();

export const ClinicalRecordController = {

  // Create Consultation
  async createConsultation(req: AuthRequest, res: Response) {
    try {
      const providerUserId = req.user!.id;
      const encounterId = req.params.encounterId as string;
      const { chiefComplaint, clinicalNotes, assessment, plan } = req.body;

      if (!chiefComplaint || !clinicalNotes || !assessment || !plan) {
        res.status(400).json({ error: "Missing required consultation fields" });
        return;
      }

      // Authorize Provider against Encounter
      const encounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          hospital: { include: { memberships: { where: { userId: providerUserId, status: "ACTIVE" } } } }
        }
      });

      if (!encounter) {
        res.status(404).json({ error: "Encounter not found" });
        return;
      }

      if (encounter.providerId !== providerUserId) {
         res.status(403).json({ error: "Provider not authorized for this encounter" });
         return;
      }

      if (encounter.hospital.memberships.length === 0) {
        res.status(403).json({ error: "Provider is not an active member of the hospital" });
        return;
      }

      if (encounter.status !== "ACTIVE" && encounter.status !== "IN_PROGRESS") {
        res.status(400).json({ error: "Can only create records for IN_PROGRESS or ACTIVE encounters" });
        return;
      }

      // Get Doctor Profile
      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: providerUserId } });
      if (!doctorProfile) {
        res.status(403).json({ error: "User is not registered as a doctor" });
        return;
      }

      // Create transaction
      const record = await prisma.$transaction(async (tx) => {
        const mr = await tx.medicalRecord.create({
          data: {
            patientId: encounter.patientId,
            encounterId: encounter.id,
            hospitalId: encounter.hospitalId,
            category: RecordCategory.CONSULTATION,
            source: RecordSource.DOCTOR,
            provenanceStatus: ProvenanceStatus.PROVIDER_CREATED,
            createdByUserId: providerUserId,
            title: "Clinical Consultation",
            occurredAt: new Date(),
            consultation: {
              create: {
                doctorProfileId: doctorProfile.id,
                hospitalId: encounter.hospitalId,
                encounterAt: encounter.startedAt || new Date(),
                clinicalSummary: {
                  chiefComplaint,
                  clinicalNotes,
                  assessment,
                  plan
                }
              }
            }
          },
          include: { consultation: true }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: providerUserId,
            action: "RECORD_UPLOADED" as any, // Mapped AuditAction
            targetType: "MedicalRecord",
            targetId: mr.id,
            metadata: { encounterId, type: "CONSULTATION" }
          }
        });

        return mr;
      });

      res.status(201).json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // Create Prescription
  async createPrescription(req: AuthRequest, res: Response) {
    try {
      const providerUserId = req.user!.id;
      const encounterId = req.params.encounterId as string;
      const { items, instructions } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Prescription must have at least one medication item" });
        return;
      }

      // Validate items briefly
      for (const item of items) {
        if (!item.medicationName) {
           res.status(400).json({ error: "Each item must have a medicationName" });
           return;
        }
      }

      // Authorize Provider against Encounter
      const encounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          hospital: { include: { memberships: { where: { userId: providerUserId, status: "ACTIVE" } } } }
        }
      });

      if (!encounter) {
        res.status(404).json({ error: "Encounter not found" });
        return;
      }

      if (encounter.providerId !== providerUserId) {
         res.status(403).json({ error: "Provider not authorized for this encounter" });
         return;
      }

      if (encounter.hospital.memberships.length === 0) {
        res.status(403).json({ error: "Provider is not an active member of the hospital" });
        return;
      }

      if (encounter.status !== "ACTIVE" && encounter.status !== "IN_PROGRESS") {
        res.status(400).json({ error: "Can only create records for IN_PROGRESS or ACTIVE encounters" });
        return;
      }

      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: providerUserId } });
      if (!doctorProfile) {
        res.status(403).json({ error: "User is not registered as a doctor" });
        return;
      }

      const record = await prisma.$transaction(async (tx) => {
        const mr = await tx.medicalRecord.create({
          data: {
            patientId: encounter.patientId,
            encounterId: encounter.id,
            hospitalId: encounter.hospitalId,
            category: RecordCategory.PRESCRIPTION,
            source: RecordSource.DOCTOR,
            provenanceStatus: ProvenanceStatus.PROVIDER_CREATED,
            createdByUserId: providerUserId,
            title: "Medical Prescription",
            occurredAt: new Date(),
            issuedAt: new Date(),
            prescription: {
              create: {
                doctorProfileId: doctorProfile.id,
                issuedAt: new Date(),
                instructions,
                items: {
                  create: items.map(i => ({
                    medicationName: i.medicationName,
                    dosage: i.dosage,
                    frequency: i.frequency,
                    duration: i.duration,
                    quantity: i.quantity,
                    instructions: i.instructions
                  }))
                }
              }
            }
          },
          include: { prescription: { include: { items: true } } }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: providerUserId,
            action: "RECORD_UPLOADED" as any,
            targetType: "MedicalRecord",
            targetId: mr.id,
            metadata: { encounterId, type: "PRESCRIPTION" }
          }
        });

        return mr;
      });

      res.status(201).json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // Get Provider Encounter Records
  async getProviderEncounterRecords(req: AuthRequest, res: Response) {
    try {
      const providerUserId = req.user!.id;
      const encounterId = req.params.encounterId as string;

      const encounter = await prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          hospital: { include: { memberships: { where: { userId: providerUserId, status: "ACTIVE" } } } }
        }
      });

      if (!encounter || encounter.providerId !== providerUserId || encounter.hospital.memberships.length === 0) {
        res.status(403).json({ error: "Unauthorized access to encounter records" });
        return;
      }

      const records = await prisma.medicalRecord.findMany({
        where: { encounterId },
        include: {
          consultation: true,
          prescription: { include: { items: true } },
          createdByUser: { select: { id: true, doctorProfile: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      // Log access
      await prisma.accessLog.create({
        data: {
          actorUserId: providerUserId,
          patientId: encounter.patientId,
          resourceType: "EncounterRecords",
          resourceId: encounter.id,
          action: "VIEW",
          outcome: "ALLOWED"
        }
      });

      res.json(records);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
