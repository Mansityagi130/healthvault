import { databaseClient } from "../config/database.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { 
  RecordCategory, 
  ConsentStatus, 
  SharingSessionStatus, 
  QRUsageMode,
  AuditAction,
  AccessAction,
  AccessOutcome
} from "../generated/prisma/enums.js";

const prisma = databaseClient.getClient();

export class SharingService {
  /**
   * Creates a direct share from a patient to a provider.
   * This instantly creates an APPROVED Consent, an ACTIVE SharingSession, and a QRSession.
   */
  static async createDirectShare(
    userId: string,
    granteeUserId: string,
    purpose: string,
    categories: RecordCategory[],
    durationMinutes: number
  ) {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error("Profile not found");

    if (categories.length === 0) {
      throw new Error("Must select at least one record category");
    }

    if (durationMinutes <= 0 || durationMinutes > 1440) { // Max 24 hours
      throw new Error("Invalid duration");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000);

    // Generate high-entropy secure QR token
    const rawSecret = crypto.randomBytes(32).toString("hex");
    const selector = uuidv4();
    const tokenHash = crypto.createHash("sha256").update(rawSecret).digest("hex");

    const result = await prisma.$transaction(async (txn) => {
      // 1. Create Consent
      const consent = await txn.consent.create({
        data: {
          patientId: profile.id,
          granteeUserId,
          purpose,
          status: ConsentStatus.APPROVED,
          approvedAt: now,
          expiresAt,
          scopes: {
            create: categories.map(c => ({ recordCategory: c }))
          }
        },
        include: { scopes: true }
      });

      // 2. Create Sharing Session
      const session = await txn.sharingSession.create({
        data: {
          patientId: profile.id,
          granteeUserId,
          consentId: consent.id,
          purposeSnapshot: purpose,
          status: SharingSessionStatus.ACTIVE,
          startsAt: now,
          expiresAt,
          scopes: {
            create: categories.map(c => ({ recordCategory: c }))
          }
        },
        include: { scopes: true, grantee: { include: { doctorProfile: true } } }
      });

      // 3. Create QR Session (CONTROLLED_REUSE for prototype UX resilience, max 5 uses)
      const qrSession = await txn.qRSession.create({
        data: {
          sharingSessionId: session.id,
          selector,
          tokenHash,
          usageMode: QRUsageMode.CONTROLLED_REUSE,
          maxUses: 5,
          expiresAt
        }
      });

      // 4. Audit
      await txn.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.CONSENT_APPROVED,
          targetType: "Consent",
          targetId: consent.id
        }
      });

      await txn.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.SHARING_SESSION_CREATED,
          targetType: "SharingSession",
          targetId: session.id
        }
      });

      await txn.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.QR_SESSION_CREATED,
          targetType: "QRSession",
          targetId: qrSession.id
        }
      });

      return { session, qrSession };
    });

    // Return the raw token ONLY ONCE. It is never stored.
    return {
      session: result.session,
      qrPayload: {
        selector,
        token: rawSecret
      }
    };
  }

  static async getPatientShares(userId: string) {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error("Profile not found");

    const sessions = await prisma.sharingSession.findMany({
      where: { patientId: profile.id },
      include: {
        scopes: true,
        grantee: { include: { doctorProfile: true } },
        consent: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return sessions;
  }

  static async revokeSharingSession(userId: string, sessionId: string) {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error("Profile not found");

    const session = await prisma.sharingSession.findUnique({
      where: { id: sessionId },
      include: { consent: true }
    });

    if (!session || session.patientId !== profile.id) {
      throw new Error("Sharing session not found");
    }

    const now = new Date();

    await prisma.$transaction(async (txn) => {
      // Revoke Session
      await txn.sharingSession.update({
        where: { id: sessionId },
        data: {
          status: SharingSessionStatus.REVOKED,
          revokedAt: now
        }
      });

      // Revoke any active QR sessions attached
      await txn.qRSession.updateMany({
        where: { sharingSessionId: sessionId, revokedAt: null },
        data: {
          revokedAt: now
        }
      });

      // Revoke Consent (since this is direct 1:1 mapped in prototype)
      if (session.consent.status !== ConsentStatus.REVOKED) {
        await txn.consent.update({
          where: { id: session.consentId },
          data: {
            status: ConsentStatus.REVOKED,
            revokedAt: now,
            revokedByUserId: userId
          }
        });
      }

      await txn.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.SHARING_SESSION_REVOKED,
          targetType: "SharingSession",
          targetId: sessionId
        }
      });
    });

    return { success: true };
  }

  /**
   * Resolves an opaque QR token into a SharingSession context.
   * This does NOT return medical records, it returns the Auth Context.
   */
  static async resolveQrToken(providerUserId: string, selector: string, rawToken: string) {
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();

    const qrSession = await prisma.qRSession.findUnique({
      where: { selector },
      include: {
        sharingSession: {
          include: {
            consent: true,
            scopes: true,
            patient: true
          }
        }
      }
    });

    if (!qrSession) {
      throw new Error("QR session is invalid or expired.");
    }

    // 1. Verify token hash matches
    if (qrSession.tokenHash !== hash) {
      throw new Error("QR session is invalid or expired.");
    }

    // 2. Verify QR not revoked or expired
    if (qrSession.revokedAt || qrSession.expiresAt < now) {
      throw new Error("QR session is invalid or expired.");
    }

    // 3. Verify usage limits
    if (qrSession.maxUses && qrSession.useCount >= qrSession.maxUses) {
      throw new Error("QR session usage limit exceeded.");
    }

    const session = qrSession.sharingSession;
    const consent = session.consent;

    // 4. Verify SharingSession is active
    if (session.status !== SharingSessionStatus.ACTIVE || session.revokedAt || session.expiresAt < now) {
      throw new Error("Sharing session is invalid or expired.");
    }

    // 5. Verify Consent is approved
    if (consent.status !== ConsentStatus.APPROVED || consent.revokedAt || consent.expiresAt < now) {
      throw new Error("Consent is invalid or expired.");
    }

    // 6. Verify grantee identity matches the scanning provider
    if (session.granteeUserId !== providerUserId) {
      throw new Error("Unauthorized: This sharing session is not intended for the authenticated provider.");
    }

    // Mark QR usage atomically to prevent TOCTOU race condition
    if (qrSession.maxUses) {
      const updateResult = await prisma.qRSession.updateMany({
        where: { 
          id: qrSession.id,
          useCount: { lt: qrSession.maxUses }
        },
        data: { 
          useCount: { increment: 1 },
          consumedAt: now
        }
      });
      if (updateResult.count === 0) {
        throw new Error("QR session usage limit exceeded.");
      }
    } else {
      await prisma.qRSession.update({
        where: { id: qrSession.id },
        data: { 
          useCount: { increment: 1 },
          consumedAt: now
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: providerUserId,
        action: AuditAction.QR_SCAN_SUCCESS,
        targetType: "QRSession",
        targetId: qrSession.id
      }
    });

    // Return the authorization context ONLY (No medical records!)
    return {
      sharingSessionId: session.id,
      patientId: session.patientId,
      patientName: `${session.patient.firstName} ${session.patient.lastName}`,
      expiresAt: session.expiresAt,
      scopes: session.scopes.map(s => s.recordCategory)
    };
  }
}
