import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { generateSecret, verify as verifyTotp, generateURI } from "otplib";
import { databaseClient } from "../config/database.js";
import { env } from "../config/env.js";
import { AuditAction, AccountStatus, NotificationType, NotificationStatus } from "../generated/prisma/enums.js";
import { z } from "zod";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import { encryptMfaSecret, decryptMfaSecret } from "../utils/crypto.js";

const prisma = databaseClient.getClient();

export class AuthService {
  private static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private static comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private static generateAccessToken(userId: string, sessionId: string, stepUp: boolean = false): string {
    return jwt.sign(
      { sessionId, type: "access", stepUp }, 
      env.JWT_ACCESS_SECRET, 
      { 
        expiresIn: "15m",
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        subject: userId
      }
    );
  }

  private static generateRefreshToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(40).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    return { token, hash };
  }

  static async register(data: z.infer<typeof registerSchema>) {
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new Error("User already exists");
    } else if (data.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existing) throw new Error("User already exists");
    }

    const passwordHash = await this.hashPassword(data.password);

    const user = await prisma.$transaction(async (tx: unknown) => {
      const txn = tx as typeof prisma;
      const newUser = await txn.user.create({
        data: {
          email: data.email ?? null,
          phone: data.phone ?? null,
          passwordHash,
        },
      });

      await txn.patientProfile.create({
        data: {
          userId: newUser.id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
        },
      });

      await txn.auditLog.create({
        data: {
          actorUserId: newUser.id,
          action: AuditAction.REGISTER,
          metadata: { email: data.email, phone: data.phone },
        },
      });

      return newUser;
    });

    return { user: { id: user.id, email: user.email, phone: user.phone, status: user.status, roles: ["PATIENT"] } };
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  static async login(data: z.infer<typeof loginSchema>, metadata?: any) {
    const user = await prisma.user.findUnique({
      where: data.email ? { email: data.email } : { phone: data.phone! },
      include: {
        patientProfile: true,
        doctorProfile: true
      }
    });

    if (!user || !user.passwordHash || user.status !== AccountStatus.ACTIVE) {
      if (user) {
        await prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            action: AuditAction.LOGIN_FAILED,
            metadata: { reason: "Invalid credentials or inactive account" },
          },
        });
      }
      throw new Error("Invalid credentials");
    }

    const isValid = await this.comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.LOGIN_FAILED,
          metadata: { reason: "Invalid credentials" },
        },
      });
      throw new Error("Invalid credentials");
    }

    if (user.mfaEnabled) {
      // Return temporary MFA token
      const mfaToken = jwt.sign(
        { type: "mfa_pending" },
        env.JWT_ACCESS_SECRET,
        {
          expiresIn: "5m",
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
          subject: user.id
        }
      );
      return { mfaRequired: true, mfaToken };
    }

    const { token: refreshToken, hash: refreshTokenHash } = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        familyId: crypto.randomUUID(),
        metadata,
      },
    });

    const accessToken = this.generateAccessToken(user.id, session.id);

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: AuditAction.LOGIN,
        metadata: { sessionId: session.id },
      },
    });

    const roles: string[] = [];
    if (user.patientProfile) roles.push("PATIENT");
    if (user.doctorProfile) roles.push("DOCTOR");
    if (roles.length === 0) roles.push("PATIENT");

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, phone: user.phone, status: user.status, roles },
    };
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  static async loginMfa(mfaToken: string, code: string, metadata?: any) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
    let decoded: any;
    try {
      decoded = jwt.verify(mfaToken, env.JWT_ACCESS_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });
    } catch {
      throw new Error("MFA token expired or invalid");
    }

    if (decoded.type !== "mfa_pending") {
      throw new Error("Invalid MFA token");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        patientProfile: true,
        doctorProfile: true
      }
    });

    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new Error("User not found or inactive");
    }

    let isVerified = false;
    let isBackupUsed = false;

    if (code.length === 6) {
      if (!user.mfaSecret) {
        throw new Error("MFA is not set up");
      }
      const secret = decryptMfaSecret(user.mfaSecret);
      const mfaRes = await verifyTotp({ token: code, secret });
      isVerified = mfaRes.valid;
    } else {
      // Check backup codes
      const hashedInput = crypto.createHash("sha256").update(code).digest("hex");
      const codeIndex = user.mfaBackupCodes.indexOf(hashedInput);
      if (codeIndex !== -1) {
        isVerified = true;
        isBackupUsed = true;
        
        // Consume the code
        const updatedBackupCodes = [...user.mfaBackupCodes];
        updatedBackupCodes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: updatedBackupCodes }
        });
      }
    }

    if (!isVerified) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.MFA_VERIFICATION_FAILED,
          metadata: { method: code.length === 6 ? "totp" : "recovery_code" }
        }
      });
      throw new Error("Invalid MFA code");
    }

    const { token: refreshToken, hash: refreshTokenHash } = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        familyId: crypto.randomUUID(),
        metadata,
      },
    });

    const accessToken = this.generateAccessToken(user.id, session.id);

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: isBackupUsed ? AuditAction.RECOVERY_CODE_USED : AuditAction.LOGIN,
        metadata: { sessionId: session.id }
      }
    });

    const roles: string[] = [];
    if (user.patientProfile) roles.push("PATIENT");
    if (user.doctorProfile) roles.push("DOCTOR");
    if (roles.length === 0) roles.push("PATIENT");

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, phone: user.phone, status: user.status, roles },
    };
  }

  static async enrollMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const secret = generateSecret();
    const encryptedSecret = encryptMfaSecret(secret);

    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecretPending: encryptedSecret }
    });

    const otpauth = generateURI({
      secret,
      label: user.email || user.phone || "user",
      issuer: "HealthVault"
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.MFA_ENROLLMENT_STARTED
      }
    });

    return { secret, otpauth };
  }

  static async confirmMfa(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecretPending) throw new Error("MFA enrollment not initiated");

    const secret = decryptMfaSecret(user.mfaSecretPending);
    const mfaRes = await verifyTotp({ token: code, secret });
    const isVerified = mfaRes.valid;

    if (!isVerified) {
      throw new Error("Invalid verification code");
    }

    // Generate 10 backup codes
    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const raw = crypto.randomBytes(6).toString("hex"); // 12 characters hex
      rawCodes.push(raw);
      hashedCodes.push(crypto.createHash("sha256").update(raw).digest("hex"));
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: user.mfaSecretPending,
        mfaSecretPending: null,
        mfaBackupCodes: hashedCodes
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.MFA_ENABLED
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.RECOVERY_CODES_GENERATED
      }
    });

    // Enqueue security notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SECURITY,
        status: NotificationStatus.PENDING,
        payload: {
          title: "MFA Enabled",
          message: "MFA has been successfully enabled on your account."
        }
      }
    });

    await prisma.outboxEvent.create({
      data: {
        topic: "NOTIFICATION",
        payload: { notificationId: notification.id }
      }
    });

    return { backupCodes: rawCodes };
  }

  static async disableMfa(userId: string, sessionId?: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: []
      }
    });

    // Revoke all other sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for dynamic query filter mapping
    const where: any = { 
      userId, 
      revokedAt: null 
    };
    if (sessionId) {
      where.id = { not: sessionId };
    }
    await prisma.authSession.updateMany({
      where,
      data: { revokedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.MFA_DISABLED
      }
    });

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SECURITY,
        status: NotificationStatus.PENDING,
        payload: {
          title: "MFA Disabled",
          message: "MFA has been disabled on your account. All active sessions have been terminated."
        }
      }
    });

    await prisma.outboxEvent.create({
      data: {
        topic: "NOTIFICATION",
        payload: { notificationId: notification.id }
      }
    });
  }

  static async regenerateRecoveryCodes(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled) throw new Error("MFA must be enabled");

    const rawCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const raw = crypto.randomBytes(6).toString("hex");
      rawCodes.push(raw);
      hashedCodes.push(crypto.createHash("sha256").update(raw).digest("hex"));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedCodes }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.RECOVERY_CODES_GENERATED
      }
    });

    return { backupCodes: rawCodes };
  }

  static async changePassword(userId: string, currentPass: string, newPass: string, sessionId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new Error("User not found");

    const isValid = await this.comparePassword(currentPass, user.passwordHash);
    if (!isValid) throw new Error("Incorrect current password");

    // Complex requirements: min 10 chars, upper, lower, number, symbol
    const complexRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{10,}$/;
    if (!complexRegex.test(newPass)) {
      throw new Error("Password does not meet complexity requirements");
    }

    const isSame = await this.comparePassword(newPass, user.passwordHash);
    if (isSame) throw new Error("New password cannot be the same as the current password");

    const passwordHash = await this.hashPassword(newPass);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    // Invalidate other sessions
    await prisma.authSession.updateMany({
      where: {
        userId,
        id: { not: sessionId },
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.PASSWORD_CHANGED
      }
    });

    await prisma.outboxEvent.create({
      data: {
        topic: "NOTIFICATION",
        payload: {
          type: "SECURITY_UPDATE",
          userId,
          title: "Password Changed",
          message: "Your password has been successfully changed."
        }
      }
    });
  }

  static async forgotPassword(identity: string) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identity },
          { phone: identity }
        ]
      }
    });

    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate previous tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { expiresAt: new Date() }
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: AuditAction.PASSWORD_RESET_REQUESTED
      }
    });

    await prisma.outboxEvent.create({
      data: {
        topic: "NOTIFICATION",
        payload: {
          type: "SECURITY_UPDATE",
          userId: user.id,
          title: "Password Reset Requested",
          message: "A password reset request was initiated. Use the following link to reset your password: /reset-password?token=" + token
        }
      }
    });
  }

  static async resetPassword(token: string, newPass: string) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new Error("Invalid or expired reset token");
    }

    const complexRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{10,}$/;
    if (!complexRegex.test(newPass)) {
      throw new Error("Password does not meet complexity requirements");
    }

    const isSame = await this.comparePassword(newPass, resetToken.user.passwordHash!);
    if (isSame) throw new Error("New password cannot be the same as the current password");

    const passwordHash = await this.hashPassword(newPass);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for transaction typing
    await prisma.$transaction(async (tx: any) => {
      const updated = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() }
      });

      if (updated.count === 0) {
        throw new Error("Invalid or expired reset token");
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      });

      await tx.authSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: resetToken.userId,
          action: AuditAction.PASSWORD_RESET_COMPLETED
        }
      });

      await tx.outboxEvent.create({
        data: {
          topic: "NOTIFICATION",
          payload: {
            type: "SECURITY_UPDATE",
            userId: resetToken.userId,
            title: "Password Reset Completed",
            message: "Your password was successfully reset. All active sessions have been logged out."
          }
        }
      });
    });
  }

  static async generateStepUpToken(userId: string, sessionId: string): Promise<string> {
    return jwt.sign(
      { sessionId, type: "step-up" },
      env.JWT_ACCESS_SECRET,
      {
        expiresIn: "5m",
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        subject: userId
      }
    );
  }

  static async refresh(refreshToken: string) {
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const session = await prisma.authSession.findUnique({
      where: { refreshTokenHash: hash },
    });

    if (!session) {
      throw new Error("Invalid refresh token");
    }

    const isRevokedOrExpired = session.revokedAt || session.expiresAt < new Date();

    const updateCount = await prisma.authSession.updateMany({
      where: { 
        id: session.id,
        revokedAt: null
      },
      data: { 
        revokedAt: new Date()
      },
    });

    if (updateCount.count === 0 || isRevokedOrExpired) {
      await prisma.authSession.updateMany({
        where: {
          userId: session.userId,
          familyId: session.familyId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
      
      await prisma.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: AuditAction.SESSION_REVOKED,
          metadata: { reason: "token reuse detected", familyId: session.familyId },
        },
      });

      throw new Error("Refresh token expired or revoked");
    }

    const { token: newRefreshToken, hash: newHash } = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for transaction typing
    const newSession = await prisma.$transaction(async (tx: any) => {
      const created = await tx.authSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: newHash,
          expiresAt,
          familyId: session.familyId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for database typing
          metadata: session.metadata ? session.metadata as any : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: AuditAction.TOKEN_REFRESH,
          metadata: { oldSessionId: session.id },
        },
      });

      return created;
    });

    const accessToken = this.generateAccessToken(session.userId, newSession.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(sessionId: string, userId: string) {
    await prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.LOGOUT,
        metadata: { sessionId },
      },
    });
  }

  static async logoutAll(userId: string) {
    await prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.SESSION_REVOKED,
        metadata: { scope: "ALL" },
      },
    });
  }
}
