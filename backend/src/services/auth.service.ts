import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { databaseClient } from "../config/database.js";
import { env } from "../config/env.js";
import { AuditAction, AccountStatus } from "../generated/prisma/enums.js";
import { z } from "zod";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";

const prisma = databaseClient.getClient();

export class AuthService {
  private static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private static comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private static generateAccessToken(userId: string, sessionId: string): string {
    return jwt.sign(
      { sessionId, type: "access" }, 
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
    // Check for existing user
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
    
    // Fallback if none (e.g. freshly created or broken data)
    if (roles.length === 0) roles.push("PATIENT");

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, phone: user.phone, status: user.status, roles },
    };
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

    // 1. Atomic Revocation for Race Condition Prevention
    // Try to atomically revoke this exact session if it hasn't been revoked yet
    const updateCount = await prisma.authSession.updateMany({
      where: { 
        id: session.id,
        revokedAt: null
      },
      data: { 
        revokedAt: new Date()
      },
    });

    // If updateCount.count === 0, it means it was already revoked!
    // This could be concurrent refresh (race condition) or malicious reuse.
    if (updateCount.count === 0 || isRevokedOrExpired) {
      // Reuse detected! Compromised family!
      // Revoke all tokens in this family (all sessions with same familyId)
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

    // 2. Normal Rotation (Update succeeded atomically)
    const { token: newRefreshToken, hash: newHash } = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newSession = await prisma.$transaction(async (tx: any) => {
      const created = await tx.authSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: newHash,
          expiresAt,
          familyId: session.familyId, // Persist the family
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
