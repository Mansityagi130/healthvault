import { databaseClient } from "../config/database.js";
import { 
  RecordSource, 
  ProvenanceStatus, 
  AuditAction,
  AccessAction,
  AccessOutcome
} from "../generated/prisma/enums.js";

const prisma = databaseClient.getClient();

export class RecordService {
  static async getPatientProfile(userId: string) {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new Error("Patient profile not found");
    }
    return profile;
  }

  static async listRecords(
    userId: string, 
    query: {
      page: number;
      pageSize: number;
      category?: any;
      search?: string | undefined;
      dateFrom?: string | undefined;
      dateTo?: string | undefined;
      provenance?: any;
      status?: any;
    }
  ) {
    const profile = await this.getPatientProfile(userId);
    
    const where: any = {
      patientId: profile.id,
    };

    if (query.category) where.category = query.category;
    if (query.provenance) where.provenanceStatus = query.provenance;
    if (query.status) where.lifecycleStatus = query.status;
    
    if (query.search) {
      where.title = { contains: query.search, mode: "insensitive" };
    }

    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }

    const [items, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          publicId: true,
          category: true,
          title: true,
          occurredAt: true,
          source: true,
          provenanceStatus: true,
          lifecycleStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.medicalRecord.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      }
    };
  }

  static async getRecord(userId: string, recordId: string) {
    const profile = await this.getPatientProfile(userId);

    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: {
        consultation: true,
        prescription: true,
        labReport: true,
        imagingRecord: true,
        dischargeSummary: true,
        vaccinationRecord: true,
        documents: true,
      }
    });

    if (!record || record.patientId !== profile.id) {
      // Must not leak whether the record exists or not to unauthorized users
      throw new Error("Record not found");
    }

    // Convert BigInt for JSON serialization
    const serializedRecord = {
      ...record,
      documents: record.documents.map(doc => ({
        ...doc,
        byteSize: doc.byteSize.toString(),
      }))
    };

    // Log access
    await prisma.accessLog.create({
      data: {
        actorUserId: userId,
        patientId: profile.id,
        medicalRecordId: record.id,
        resourceType: "MedicalRecord",
        resourceId: record.id,
        action: AccessAction.VIEW,
        outcome: AccessOutcome.ALLOWED,
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.RECORD_VIEWED,
        targetType: "MedicalRecord",
        targetId: record.id,
      }
    });
    return serializedRecord;
  }

  static async createRecord(userId: string, data: {
    category: any;
    title: string;
    occurredAt: string;
  }) {
    const profile = await this.getPatientProfile(userId);

    const record = await prisma.$transaction(async (txn) => {
      const newRecord = await txn.medicalRecord.create({
        data: {
          patientId: profile.id,
          createdByUserId: userId,
          category: data.category,
          title: data.title,
          occurredAt: new Date(data.occurredAt),
          source: RecordSource.PATIENT,
          provenanceStatus: ProvenanceStatus.PATIENT_UPLOADED,
        }
      });

      await txn.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.RECORD_UPLOADED,
          targetType: "MedicalRecord",
          targetId: newRecord.id,
        }
      });

      return newRecord;
    });

    return record;
  }

  static async updateRecord(userId: string, recordId: string, data: {
    title?: string | undefined;
    category?: any | undefined;
    occurredAt?: string | undefined;
    lifecycleStatus?: any | undefined;
  }) {
    const profile = await this.getPatientProfile(userId);

    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
    });

    if (!record || record.patientId !== profile.id) {
      throw new Error("Record not found");
    }

    const cleanData: any = {};
    if (data.title !== undefined) cleanData.title = data.title;
    if (data.category !== undefined) cleanData.category = data.category;
    if (data.occurredAt !== undefined) cleanData.occurredAt = new Date(data.occurredAt);
    if (data.lifecycleStatus !== undefined) cleanData.lifecycleStatus = data.lifecycleStatus;

    const updated = await prisma.medicalRecord.update({
      where: { id: recordId },
      data: cleanData,
      select: {
        id: true,
        publicId: true,
        category: true,
        title: true,
        occurredAt: true,
        source: true,
        provenanceStatus: true,
        lifecycleStatus: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        // Using a generic action since RECORD_UPDATED isn't in AuditAction, 
        // we can use RECORD_UPLOADED or just a generic event, or skip audit if not strictly required in the enum.
        // Actually, we'll just not log audit here since RECORD_UPDATED is not in the schema enum.
        // Wait, the prompt says "RECORD_CREATED, RECORD_VIEWED, RECORD_UPDATED". Let's check if the schema enum actually has it.
        // The enum earlier showed:
        // RECORD_UPLOADED, RECORD_VIEWED, RECORD_DOWNLOADED
        // We will just use RECORD_UPLOADED for updates if we must, or we can omit it if it's not strictly available. Let's omit or just log AccessLog.
        action: AuditAction.RECORD_UPLOADED,
        targetType: "MedicalRecord",
        targetId: recordId,
        metadata: { event: "UPDATE" },
      }
    });

    return updated;
  }
}
