import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { databaseClient } from "../config/database.js";
const prisma = databaseClient.getClient();
import { 
  createLabReportSchema, 
  updateLabReportSchema,
  addLabResultSchema,
  updateLabResultSchema
} from "../schemas/lab.schema.js";
import { 
  RecordSource, 
  ProvenanceStatus,
  RecordCategory,
  MembershipRole,
  MembershipStatus,
  LabReportStatus,
  AuditAction,
  AccessAction,
  AccessOutcome,
  AssociationStatus
} from "../generated/prisma/enums.js";
import { NotificationType } from "../generated/prisma/enums.js";
import { notificationService } from "../services/notification.service.js";

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

export const LabController = {
  // 1. Create a Draft Lab Report
  async createReport(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const labId = req.params.labId as string;
      const data = createLabReportSchema.parse(req.body);

      // Verify lab membership
      await verifyLabMembership(user.id, labId);

      // Verify patient exists
      const patient = await prisma.patientProfile.findUnique({
        where: { id: data.patientId }
      });
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      // Verify ACTIVE PatientLabAssociation
      const association = await prisma.patientLabAssociation.findFirst({
        where: {
          patientId: patient.id,
          labId: labId,
          status: AssociationStatus.ACTIVE
        }
      });

      if (!association) {
        return res.status(403).json({ error: "An ACTIVE association is required to create lab reports for this patient" });
      }

      // Verify encounter if provided
      if (data.encounterId) {
        const encounter = await prisma.encounter.findUnique({
          where: { id: data.encounterId }
        });
        if (!encounter || encounter.patientId !== patient.id) {
          return res.status(400).json({ error: "Invalid encounter" });
        }
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create root Medical Record
        const medicalRecord = await tx.medicalRecord.create({
          data: {
            patientId: patient.id,
            category: RecordCategory.LAB_REPORT,
            source: RecordSource.LAB,
            provenanceStatus: ProvenanceStatus.LAB_VERIFIED, // Strictly derived
            title: data.title || "Laboratory Report",
            occurredAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
            issuedAt: new Date(),
            createdByUserId: user.id,
            labId: labId,
            encounterId: data.encounterId ?? null,
          }
        });

        // Create LabReport child
        const labReport = await tx.labReport.create({
          data: {
            medicalRecordId: medicalRecord.id,
            labId: labId,
            createdByUserId: user.id,
            collectedAt: data.collectedAt ? new Date(data.collectedAt) : null,
            reportedAt: new Date(),
            status: LabReportStatus.DRAFT
          },
          include: { medicalRecord: true }
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: AuditAction.RECORD_UPLOADED, // Close enough
            targetType: "LabReport",
            targetId: labReport.id,
          }
        });

        return labReport;
      });

      res.status(201).json(result);
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

  // 2. Add Result to Draft Report
  async addResult(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const labId = req.params.labId as string;
      const reportId = req.params.reportId as string;
      const data = addLabResultSchema.parse(req.body);

      await verifyLabMembership(user.id, labId);

      const report = await prisma.labReport.findUnique({
        where: { id: reportId }
      });

      if (!report || report.labId !== labId) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.status !== LabReportStatus.DRAFT) {
        return res.status(400).json({ error: "Results can only be added to DRAFT reports" });
      }

      const result = await prisma.labResult.create({
        data: {
          labReportId: reportId,
          testName: data.testName,
          value: data.value,
          valueType: data.valueType,
          status: data.status,
          testCode: data.testCode ?? null,
          unit: data.unit ?? null,
          referenceRange: data.referenceRange ?? null
        }
      });

      res.status(201).json(result);
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

  // 3. Finalize Report
  async finalizeReport(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const labId = req.params.labId as string;
      const reportId = req.params.reportId as string;

      await verifyLabMembership(user.id, labId);

      const report = await prisma.labReport.findUnique({
        where: { id: reportId }
      });

      if (!report || report.labId !== labId) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.status !== LabReportStatus.DRAFT) {
        return res.status(400).json({ error: "Only DRAFT reports can be finalized" });
      }

      const updated = await prisma.labReport.update({
        where: { id: reportId },
        data: { status: LabReportStatus.FINALIZED },
        include: { medicalRecord: { include: { encounter: true, patient: true } } }
      });

      // Notify Patient
      const patientId = updated.medicalRecord.patientId;
      const patient = await prisma.patientProfile.findUnique({ where: { id: patientId } });
      if (patient) {
        await notificationService.createNotification({
          userId: patient.userId,
          type: NotificationType.LAB_REPORT_FINALIZED,
          title: "Lab Report Finalized",
          message: `A laboratory report has been verified and finalized.`,
          relatedResource: { type: "MedicalRecord", id: updated.medicalRecordId }
        });
      }

      // Notify Provider (if linked to encounter)
      if (updated.medicalRecord.encounter?.providerId) {
        await notificationService.createNotification({
          userId: updated.medicalRecord.encounter.providerId,
          type: NotificationType.LAB_REPORT_FINALIZED,
          title: "Lab Report Finalized for Encounter",
          message: `A lab report was finalized for an encounter.`,
          relatedResource: { type: "MedicalRecord", id: updated.medicalRecordId }
        });
      }

      res.status(200).json(updated);
    } catch (error: any) {
      if (error.message.startsWith("Unauthorized")) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  },

  async listReports(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const labId = req.params.labId as string;
      await verifyLabMembership(user.id, labId);

      let query: any = { page: 1, pageSize: 20 };
      try {
        const { listLabReportsSchema } = await import("../schemas/lab.schema.js");
        query = listLabReportsSchema.parse(req.query);
      } catch (err: any) {
        if (err.name === "ZodError") {
          res.status(400).json({ error: "Validation error", details: err.errors });
          return;
        }
        throw err;
      }

      const where: any = { labId };
      if (query.status) where.status = query.status;
      if (query.search) {
        where.OR = [
          { medicalRecord: { title: { contains: query.search, mode: "insensitive" } } },
          { medicalRecord: { patient: { firstName: { contains: query.search, mode: "insensitive" } } } },
          { medicalRecord: { patient: { lastName: { contains: query.search, mode: "insensitive" } } } }
        ];
      }
      if (query.dateFrom || query.dateTo) {
        where.reportedAt = {};
        if (query.dateFrom) where.reportedAt.gte = new Date(query.dateFrom);
        if (query.dateTo) where.reportedAt.lte = new Date(query.dateTo);
      }

      const reports = await prisma.labReport.findMany({
        where,
        include: {
          medicalRecord: { include: { patient: true } }
        },
        orderBy: { reportedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      });

      const total = await prisma.labReport.count({ where });

      res.status(200).json({
        items: reports,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize)
        }
      });
    } catch (error: any) {
      if (error.message.startsWith("Unauthorized")) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  },

  // 4. Get Report (For Lab Staff)
  async getReport(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const labId = req.params.labId as string;
      const reportId = req.params.reportId as string;

      await verifyLabMembership(user.id, labId);

      const report = await prisma.labReport.findUnique({
        where: { id: reportId },
        include: {
          medicalRecord: { include: { documents: true } },
          results: true,
        }
      });

      if (!report || report.labId !== labId) {
        return res.status(404).json({ error: "Report not found" });
      }

      res.status(200).json(report);
    } catch (error: any) {
      if (error.message.startsWith("Unauthorized")) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
};
