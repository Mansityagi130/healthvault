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
import { normalizePhoneNumber } from "../utils/phone.js";
import { SmsProvider } from "./sms.provider.js";

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
    const isTest = env.NODE_ENV === "test";
    const bypassVerification = isTest && (!data.phone || data.phone.startsWith("+999"));

    const normalizedPhone = data.phone 
      ? normalizePhoneNumber(data.phone)
      : (isTest ? `+15555${Math.floor(100000 + Math.random() * 900000)}` : normalizePhoneNumber(data.phone!));

    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new Error("User already exists");
    }
    const existingPhone = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existingPhone) throw new Error("User already exists");

    const passwordHash = await this.hashPassword(data.password);

    // Generate secure OTP code and its hash
    const otp = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const user = await prisma.$transaction(async (tx: unknown) => {
      const txn = tx as typeof prisma;
      const newUser = await txn.user.create({
        data: {
          email: data.email ?? null,
          phone: normalizedPhone,
          passwordHash,
          status: bypassVerification ? AccountStatus.ACTIVE : AccountStatus.PENDING_VERIFICATION,
        },
      });

      await txn.patientProfile.create({
        data: {
          userId: newUser.id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: normalizedPhone,
        },
      });

      if (!bypassVerification) {
        await txn.phoneVerification.create({
          data: {
            userId: newUser.id,
            codeHash,
            expiresAt,
          }
        });
      }

      await txn.auditLog.create({
        data: {
          actorUserId: newUser.id,
          action: AuditAction.REGISTER,
          metadata: { email: data.email, phone: normalizedPhone },
        },
      });

      if (!bypassVerification) {
        await txn.auditLog.create({
          data: {
            actorUserId: newUser.id,
            action: AuditAction.PHONE_VERIFICATION_REQUESTED,
            metadata: { phone: normalizedPhone },
          },
        });
      }

      return newUser;
    });

    if (!bypassVerification) {
      // Send the OTP via SmsProvider
      await SmsProvider.sendOtp(normalizedPhone, otp);

      return {
        verificationRequired: true,
        userId: user.id,
        message: "Verification code sent to your phone"
      };
    }

    return { user: { id: user.id, email: user.email, phone: user.phone, status: user.status, roles: ["PATIENT"] } };
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  static async login(data: z.infer<typeof loginSchema>, metadata?: any) {
    let query;
    if (data.email) {
      query = { email: data.email };
    } else {
      try {
        query = { phone: normalizePhoneNumber(data.phone!) };
      } catch {
        throw new Error("Invalid credentials");
      }
    }

    const user = await prisma.user.findUnique({
      where: query,
      include: {
        patientProfile: true,
        doctorProfile: true
      }
    });

    if (!user || !user.passwordHash) {
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

    if (user.status === AccountStatus.PENDING_VERIFICATION) {
      return { verificationRequired: true, userId: user.id };
    }

    if (user.status !== AccountStatus.ACTIVE) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.LOGIN_FAILED,
          metadata: { reason: "Inactive account" },
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
    if (env.NODE_ENV === "development") {
      console.log('[DEV] forgotPassword: Starting forgot-password flow for identity:', identity);
    }

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

    // DEVELOPMENT ONLY: Log reset URL for local testing
    if (env.NODE_ENV === "development") {
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
      console.log(`[DEV] Password reset URL for ${user.email || user.phone}: ${resetUrl}`);
    }
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

  static async verifyPhone(userId: string, otp: string, metadata?: any) {
    const codeHash = crypto.createHash("sha256").update(otp).digest("hex");

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          patientProfile: true,
          doctorProfile: true
        }
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.status !== AccountStatus.PENDING_VERIFICATION) {
        throw new Error("Account is already verified or active");
      }

      // Find the latest unverified verification entry
      const verification = await tx.phoneVerification.findFirst({
        where: { userId, verifiedAt: null },
        orderBy: { createdAt: "desc" }
      });

      if (!verification) {
        throw new Error("Verification code is invalid");
      }

      if (verification.expiresAt < new Date()) {
        throw new Error("Verification code has expired");
      }

      if (verification.attempts >= 5) {
        throw new Error("Too many verification attempts. Please request a new code");
      }

      if (verification.codeHash !== codeHash) {
        await tx.phoneVerification.update({
          where: { id: verification.id },
          data: { attempts: { increment: 1 } }
        });

        await tx.auditLog.create({
          data: {
            actorUserId: userId,
            action: AuditAction.PHONE_VERIFICATION_FAILED,
            metadata: { reason: "Invalid code", attempts: verification.attempts + 1 }
          }
        });

        throw new Error("Invalid verification code");
      }

      // Successful verification
      await tx.phoneVerification.update({
        where: { id: verification.id },
        data: { verifiedAt: new Date() }
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { status: AccountStatus.ACTIVE }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.PHONE_VERIFICATION_SUCCESS,
          metadata: { phone: updatedUser.phone }
        }
      });

      // Establish session
      const { token: refreshToken, hash: refreshTokenHash } = this.generateRefreshToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const session = await tx.authSession.create({
        data: {
          userId: user.id,
          refreshTokenHash,
          expiresAt,
          familyId: crypto.randomUUID(),
          metadata,
        },
      });

      const accessToken = this.generateAccessToken(user.id, session.id);

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.LOGIN,
          metadata: { sessionId: session.id }
        }
      });

      const roles: string[] = ["PATIENT"];

      return {
        accessToken,
        refreshToken,
        user: { id: updatedUser.id, email: updatedUser.email, phone: updatedUser.phone, status: updatedUser.status, roles }
      };
    });
  }

  static async resendPhoneOtp(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return { success: true, message: "If the account is pending verification, a new code has been sent." };
    }

    if (user.status !== AccountStatus.PENDING_VERIFICATION) {
      return { success: true, message: "If the account is pending verification, a new code has been sent." };
    }

    const latest = await prisma.phoneVerification.findFirst({
      where: { userId, verifiedAt: null },
      orderBy: { createdAt: "desc" }
    });

    if (latest) {
      const diffMs = Date.now() - latest.createdAt.getTime();
      const cooldownMs = 60 * 1000;
      if (diffMs < cooldownMs) {
        throw new Error("Please wait 60 seconds before requesting a new code.");
      }
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.$transaction(async (tx) => {
      await tx.phoneVerification.updateMany({
        where: { userId, verifiedAt: null },
        data: { expiresAt: new Date(0) }
      });

      await tx.phoneVerification.create({
        data: {
          userId,
          codeHash,
          expiresAt
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.PHONE_VERIFICATION_RESENT,
          metadata: { phone: user.phone }
        }
      });
    });

    await SmsProvider.sendOtp(user.phone!, otp);

    return { success: true, message: "Verification code resent successfully" };
  }
}
