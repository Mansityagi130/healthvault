import { databaseClient } from "../config/database.js";
import { 
  RecordCategory, 
  SharingSessionStatus, 
  ConsentStatus,
  AuditAction,
  AccessAction,
  AccessOutcome
} from "../generated/prisma/enums.js";

const prisma = databaseClient.getClient();

export class ProviderService {
  /**
   * Helper to validate session and return active scopes
   */
  private static async validateAndGetContext(providerId: string, sessionId: string) {
    const session = await prisma.sharingSession.findUnique({
      where: { id: sessionId },
      include: {
        consent: true,
        scopes: true,
        patient: {
          include: { user: true }
        }
      }
    });

    if (!session) throw new Error("Unauthorized");

    const now = new Date();

    if (session.granteeUserId !== providerId) throw new Error("Unauthorized");
    if (session.status !== SharingSessionStatus.ACTIVE) throw new Error("Session is not active");
    if (session.revokedAt || session.expiresAt < now) throw new Error("Session expired or revoked");

    const consent = session.consent;
    if (consent.status !== ConsentStatus.APPROVED) throw new Error("Consent is not approved");
    if (consent.revokedAt || consent.expiresAt < now) throw new Error("Consent expired or revoked");

    return session;
  }

  static async getSharedSessions(providerId: string) {
    const sessions = await prisma.sharingSession.findMany({
      where: {
        granteeUserId: providerId,
        status: SharingSessionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        revokedAt: null,
        consent: {
          status: ConsentStatus.APPROVED,
          expiresAt: { gt: new Date() },
          revokedAt: null
        }
      },
      include: {
        scopes: true,
        patient: true
      },
      orderBy: { startsAt: 'desc' }
    });

    return sessions.map(s => ({
      sessionId: s.id,
      patientDisplayName: `${s.patient.firstName} ${s.patient.lastName}`,
      purpose: s.purposeSnapshot,
      scopes: s.scopes.map(sc => sc.recordCategory),
      expiresAt: s.expiresAt,
      status: s.status
    }));
  }

  static async getSharedSessionContext(providerId: string, sessionId: string) {
    const session = await this.validateAndGetContext(providerId, sessionId);

    return {
      sessionId: session.id,
      patientId: session.patientId, // Only for internal matching, UI uses Name
      patientDisplayName: `${session.patient.firstName} ${session.patient.lastName}`,
      purpose: session.purposeSnapshot,
      scopes: session.scopes.map(s => s.recordCategory),
      expiresAt: session.expiresAt,
      status: session.status
    };
  }

  static async getSharedRecords(providerId: string, sessionId: string) {
    const session = await this.validateAndGetContext(providerId, sessionId);
    const authorizedCategories = session.scopes.map(s => s.recordCategory);

    const records = await prisma.medicalRecord.findMany({
      where: {
        patientId: session.patientId,
        category: { in: authorizedCategories }
      },
      orderBy: { occurredAt: 'desc' },
      include: {
        documents: {
          select: {
            id: true,
            originalFilename: true,
            byteSize: true,
            mimeType: true,
            uploadedAt: true
          }
        }
      }
    });

    return records.map(record => ({
      ...record,
      documents: record.documents.map(d => ({
        ...d,
        byteSize: d.byteSize.toString() // BigInt serialization
      }))
    }));
  }

  static async getSharedRecordDetail(providerId: string, sessionId: string, recordId: string) {
    const session = await this.validateAndGetContext(providerId, sessionId);
    const authorizedCategories = session.scopes.map(s => s.recordCategory);

    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: {
        documents: {
          select: {
            id: true,
            originalFilename: true,
            byteSize: true,
            mimeType: true,
            uploadedAt: true
          }
        }
      }
    });

    if (!record || record.patientId !== session.patientId) {
      throw new Error("Unauthorized");
    }

    if (!authorizedCategories.includes(record.category)) {
      await prisma.accessLog.create({
        data: {
          actorUserId: providerId,
          patientId: session.patientId,
          resourceType: "MedicalRecord",
          resourceId: record.id,
          action: AccessAction.VIEW,
          outcome: AccessOutcome.DENIED,
          consentId: session.consentId,
          sharingSessionId: session.id
        }
      });
      throw new Error("Unauthorized category");
    }

    await prisma.accessLog.create({
      data: {
        actorUserId: providerId,
        patientId: session.patientId,
        resourceType: "MedicalRecord",
        resourceId: record.id,
        action: AccessAction.VIEW,
        outcome: AccessOutcome.ALLOWED,
        consentId: session.consentId,
        sharingSessionId: session.id
      }
    });

    return {
      ...record,
      documents: record.documents.map(d => ({
        ...d,
        byteSize: d.byteSize.toString()
      }))
    };
  }

  static async getSharedDocument(providerId: string, sessionId: string, documentId: string) {
    const session = await this.validateAndGetContext(providerId, sessionId);
    const authorizedCategories = session.scopes.map(s => s.recordCategory);

    const doc = await prisma.medicalDocument.findUnique({
      where: { id: documentId },
      include: {
        medicalRecord: true
      }
    });

    if (!doc || doc.medicalRecord.patientId !== session.patientId) {
      throw new Error("Unauthorized");
    }

    if (!authorizedCategories.includes(doc.medicalRecord.category)) {
      await prisma.accessLog.create({
        data: {
          actorUserId: providerId,
          patientId: session.patientId,
          resourceType: "MedicalDocument",
          resourceId: doc.id,
          action: AccessAction.VIEW,
          outcome: AccessOutcome.DENIED,
          consentId: session.consentId,
          sharingSessionId: session.id
        }
      });
      throw new Error("Unauthorized category");
    }

    await prisma.accessLog.create({
      data: {
        actorUserId: providerId,
        patientId: session.patientId,
        resourceType: "MedicalDocument",
        resourceId: doc.id,
        action: AccessAction.VIEW,
        outcome: AccessOutcome.ALLOWED,
        consentId: session.consentId,
        sharingSessionId: session.id
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: providerId,
        action: AuditAction.SHARED_DOCUMENT_VIEWED,
        targetType: "MedicalDocument",
        targetId: doc.id
      }
    });

    return doc;
  }
}
