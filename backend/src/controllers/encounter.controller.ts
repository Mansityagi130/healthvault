import type { Encounter, EncounterStatus, EncounterType } from "../generated/prisma/client.js";
import { databaseClient } from "../config/database.js";
const prisma = databaseClient.getClient();
import type { AuthRequest } from "../middleware/auth.middleware.js";
import type { Response } from "express";
import { NotificationType } from "../generated/prisma/enums.js";
import { notificationService } from "../services/notification.service.js";

export class EncounterController {
  
  // Hospital staff/admin creates encounter for patient
  static async createHospitalEncounter(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const { patientId, departmentId, providerId, type, reason } = req.body;

      if (!patientId || !type) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Check if patient exists
      const patient = await prisma.patientProfile.findUnique({ where: { id: patientId } });
      if (!patient) {
        res.status(404).json({ error: "Patient not found" });
        return;
      }

      // If department assigned, verify it belongs to hospital
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept || dept.hospitalId !== hospitalId) {
          res.status(400).json({ error: "Invalid department for this hospital" });
          return;
        }
      }

      // If provider assigned, verify they have active membership in this hospital
      if (providerId) {
        const membership = await prisma.hospitalMembership.findFirst({
          where: { userId: providerId, hospitalId, status: "ACTIVE" }
        });
        if (!membership) {
          res.status(400).json({ error: "Provider is not an active member of this hospital" });
          return;
        }
      }

      const encounter = await prisma.encounter.create({
        data: {
          patientId,
          hospitalId,
          departmentId: departmentId || undefined,
          providerId: providerId || undefined,
          type: type as EncounterType,
          reason,
          status: "SCHEDULED"
        }
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: "ENCOUNTER_CREATED",
          targetType: "Encounter",
          targetId: encounter.id,
          metadata: { hospitalId, patientId, type }
        }
      });

      // Notify Patient
      await notificationService.createNotification({
        userId: patient.userId,
        type: NotificationType.ENCOUNTER_CREATED,
        title: "New Encounter Scheduled",
        message: `An encounter has been scheduled at the hospital.`,
        relatedResource: { type: "Encounter", id: encounter.id }
      });

      // Notify Provider if assigned
      if (providerId) {
        await notificationService.createNotification({
          userId: providerId,
          type: NotificationType.ENCOUNTER_CREATED,
          title: "New Encounter Assigned",
          message: `You have been assigned to a new encounter.`,
          relatedResource: { type: "Encounter", id: encounter.id }
        });
      }

      res.status(201).json(encounter);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get hospital encounters
  static async getHospitalEncounters(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      
      let query: any = {};
      try {
        const { listEncountersSchema } = await import("../schemas/encounter.schema.js");
        query = listEncountersSchema.parse(req.query);
      } catch (err: any) {
        if (err.name === "ZodError") {
          res.status(400).json({ error: "Validation error", details: err.errors });
          return;
        }
        throw err;
      }

      const where: any = { hospitalId };
      if (query.status) where.status = query.status;
      if (query.departmentId) where.departmentId = query.departmentId;
      if (query.search) {
        where.OR = [
          { reason: { contains: query.search, mode: "insensitive" } },
          { patient: { firstName: { contains: query.search, mode: "insensitive" } } },
          { patient: { lastName: { contains: query.search, mode: "insensitive" } } }
        ];
      }

      const encounters = await prisma.encounter.findMany({
        where,
        include: {
          patient: true,
          department: true,
          provider: { include: { doctorProfile: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      res.json(encounters);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Update encounter
  static async updateEncounter(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const encounterId = req.params.encounterId as string;
      const { status, providerId, departmentId } = req.body;

      const existing = await prisma.encounter.findUnique({ where: { id: encounterId } });
      if (!existing || existing.hospitalId !== hospitalId) {
        res.status(404).json({ error: "Encounter not found" });
        return;
      }

      // Validate lifecycle transitions
      if (status && status !== existing.status) {
        const validTransitions: Record<string, string[]> = {
          "SCHEDULED": ["CHECKED_IN", "CANCELLED"],
          "CHECKED_IN": ["IN_PROGRESS", "CANCELLED"],
          "IN_PROGRESS": ["COMPLETED"],
          "ACTIVE": ["COMPLETED"], // keep for backward compatibility
          "COMPLETED": [],
          "CANCELLED": []
        };
        if (!validTransitions[existing.status]?.includes(status)) {
          res.status(400).json({ error: `Invalid transition from ${existing.status} to ${status}` });
          return;
        }
      }

      // Verify new department
      if (departmentId && departmentId !== existing.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept || dept.hospitalId !== hospitalId) {
          res.status(400).json({ error: "Invalid department" });
          return;
        }
      }

      // Verify new provider
      if (providerId && providerId !== existing.providerId) {
        const membership = await prisma.hospitalMembership.findFirst({
          where: { userId: providerId, hospitalId, status: "ACTIVE" }
        });
        if (!membership) {
          res.status(400).json({ error: "Provider is not active in this hospital" });
          return;
        }
      }

      const updateData: any = {
        departmentId: departmentId !== undefined ? departmentId : existing.departmentId,
        providerId: providerId !== undefined ? providerId : existing.providerId,
        status: status !== undefined ? status : existing.status,
      };

      if ((status === "ACTIVE" || status === "IN_PROGRESS") && 
          (existing.status !== "ACTIVE" && existing.status !== "IN_PROGRESS")) {
        updateData.startedAt = new Date();
      } else if (status === "COMPLETED" && existing.status !== "COMPLETED") {
        updateData.endedAt = new Date();
      }

      const encounter = await prisma.encounter.update({
        where: { id: encounterId },
        data: updateData
      });

      let auditAction = "ENCOUNTER_VIEWED";
      if (status === "ACTIVE" && existing.status !== "ACTIVE") auditAction = "ENCOUNTER_ACTIVATED";
      else if (status === "CHECKED_IN" && existing.status !== "CHECKED_IN") auditAction = "ENCOUNTER_CHECKED_IN";
      else if (status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") auditAction = "ENCOUNTER_STARTED";
      else if (status === "COMPLETED") auditAction = "ENCOUNTER_COMPLETED";
      else if (status === "CANCELLED") auditAction = "ENCOUNTER_CANCELLED";
      else if (providerId && providerId !== existing.providerId) auditAction = "ENCOUNTER_PROVIDER_ASSIGNED";

      if (auditAction !== "ENCOUNTER_VIEWED") {
        await prisma.auditLog.create({
          data: {
            actorUserId: req.user!.id,
            action: auditAction as any,
            targetType: "Encounter",
            targetId: encounterId,
            metadata: { updateData }
          }
        });

        // Notify Patient
        const patient = await prisma.patientProfile.findUnique({ where: { id: existing.patientId } });
        if (patient) {
          await notificationService.createNotification({
            userId: patient.userId,
            type: NotificationType.ENCOUNTER_UPDATED,
            title: "Encounter Updated",
            message: `Your encounter status was updated to ${status || existing.status}.`,
            relatedResource: { type: "Encounter", id: encounter.id }
          });
        }

        // Notify Provider if a new one is assigned
        if (providerId && providerId !== existing.providerId) {
          await notificationService.createNotification({
            userId: providerId,
            type: NotificationType.ENCOUNTER_UPDATED,
            title: "New Encounter Assigned",
            message: `You have been assigned to an encounter.`,
            relatedResource: { type: "Encounter", id: encounter.id }
          });
        }
      }

      res.json(encounter);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get provider encounters (across all their active hospitals)
  static async getProviderEncounters(req: AuthRequest, res: Response): Promise<void> {
    try {
      let query: any = {};
      try {
        const { listEncountersSchema } = await import("../schemas/encounter.schema.js");
        query = listEncountersSchema.parse(req.query);
      } catch (err: any) {
        if (err.name === "ZodError") {
          res.status(400).json({ error: "Validation error", details: err.errors });
          return;
        }
        throw err;
      }

      // Find hospitals where provider is ACTIVE
      const memberships = await prisma.hospitalMembership.findMany({
        where: { userId: req.user!.id, status: "ACTIVE" }
      });
      const activeHospitalIds = memberships.map(m => m.hospitalId);

      const where: any = {
        providerId: req.user!.id,
        hospitalId: { in: activeHospitalIds }
      };
      
      if (query.status) where.status = query.status;
      if (query.departmentId) where.departmentId = query.departmentId;
      if (query.search) {
        where.OR = [
          { reason: { contains: query.search, mode: "insensitive" } },
          { patient: { firstName: { contains: query.search, mode: "insensitive" } } },
          { patient: { lastName: { contains: query.search, mode: "insensitive" } } }
        ];
      }

      const encounters = await prisma.encounter.findMany({
        where,
        include: {
          patient: true,
          hospital: true,
          department: true
        },
        orderBy: { createdAt: "desc" }
      });

      res.json(encounters);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Get patient encounters (for the authenticated patient)
  static async getPatientEncounters(req: AuthRequest, res: Response): Promise<void> {
    try {
      let query: any = {};
      try {
        const { listEncountersSchema } = await import("../schemas/encounter.schema.js");
        query = listEncountersSchema.parse(req.query);
      } catch (err: any) {
        if (err.name === "ZodError") {
          res.status(400).json({ error: "Validation error", details: err.errors });
          return;
        }
        throw err;
      }

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: req.user!.id }
      });
      
      if (!patientProfile) {
        res.status(404).json({ error: "Patient profile not found" });
        return;
      }

      const where: any = { patientId: patientProfile.id };
      
      if (query.status) where.status = query.status;
      if (query.departmentId) where.departmentId = query.departmentId;
      if (query.search) {
        where.reason = { contains: query.search, mode: "insensitive" };
      }

      const encounters = await prisma.encounter.findMany({
        where,
        include: {
          hospital: true,
          department: true,
          provider: { include: { doctorProfile: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      res.json(encounters);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}



