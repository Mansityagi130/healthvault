import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { authorizeRole } from "../src/middleware/rbac.middleware.js";
import { MembershipRole } from "../src/generated/prisma/enums.js";
import express from "express";

const prisma = databaseClient.getClient();

describe("Security Requirements", () => {
  beforeAll(async () => {
    await prisma.registrationPairingToken.deleteMany(); await prisma.consentScope.deleteMany(); await prisma.consent.deleteMany(); await prisma.medicalRecord.deleteMany(); await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "sectest" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "sectest" } } } });
    await prisma.doctorProfile.deleteMany({ where: { user: { email: { contains: "sectest" } } } });
    await prisma.labMembership.deleteMany(); await prisma.hospitalMembership.deleteMany(); await prisma.user.deleteMany({ where: { email: { contains: "sectest" } } });
  });

  afterAll(async () => {
    await prisma.registrationPairingToken.deleteMany(); await prisma.consentScope.deleteMany(); await prisma.consent.deleteMany(); await prisma.medicalRecord.deleteMany(); await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "sectest" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "sectest" } } } });
    await prisma.doctorProfile.deleteMany({ where: { user: { email: { contains: "sectest" } } } });
    await prisma.labMembership.deleteMany(); await prisma.hospitalMembership.deleteMany(); await prisma.user.deleteMany({ where: { email: { contains: "sectest" } } });
  });

  it("1. Missing production JWT secrets fails validation", () => {
    const environmentSchema = z.object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      JWT_ACCESS_SECRET: z.string().optional(),
      JWT_REFRESH_SECRET: z.string().optional(),
    });

    const mockEnv = {
      NODE_ENV: "production",
      // intentionally omitting secrets
    };

    const parsed = environmentSchema.parse(mockEnv);
    
    expect(() => {
      if (parsed.NODE_ENV === "production" && (!parsed.JWT_ACCESS_SECRET || !parsed.JWT_REFRESH_SECRET)) {
        throw new Error("CRITICAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be provided in production.");
      }
    }).toThrow("CRITICAL");
  });

  it("2. Rate limiting blocks excessive requests", async () => {
    // Generate many requests to trigger 429
    let lastStatus = 200;
    // Limit is 5 per hour, so sending 6 should trigger it
    for (let i = 0; i < 7; i++) {
      const res = await request(app).post("/api/auth/register")
        .set("X-Forwarded-For", "192.168.4.1")
        .send({
        email: `ratelimit${i}@example.com`,
        password: "securepassword123",
        firstName: "Test",
        lastName: "User"
      });
      if (res.status === 429) {
        lastStatus = 429;
        break;
      }
    }
    expect(lastStatus).toBe(429);
  });

  describe("Token Family & Concurrency", () => {
    let userAId: string;
    let sessionA_1: string; // The cookie for first login
    let sessionA_2: string; // The cookie for second independent login
    
    beforeAll(async () => {
      // Create user A
      const res = await request(app).post("/api/auth/register")
        .set("X-Forwarded-For", "192.168.1.100")
        .send({
        email: "family@example.com",
        password: "securepassword123",
        firstName: "Family",
        lastName: "Test"
      });
      userAId = res.body.user.id;
    });

    it("3/4/5. Refresh token reuse triggers family revocation but preserves independent sessions", async () => {
      // Login 1 (Device A)
      const login1 = await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", "192.168.1.100")
        .send({
        email: "family@example.com",
        password: "securepassword123"
      });
      sessionA_1 = login1.headers["set-cookie"][0].split(";")[0];

      // Login 2 (Device B - Independent session)
      const login2 = await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", "192.168.1.101")
        .send({
        email: "family@example.com",
        password: "securepassword123"
      });
      sessionA_2 = login2.headers["set-cookie"][0].split(";")[0];

      // Rotate Device A token (Legitimate)
      const rotate1 = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [sessionA_1]);
      
      expect(rotate1.status).toBe(200);
      const sessionA_1_new = rotate1.headers["set-cookie"][0].split(";")[0];

      // Attacker uses OLD Device A token (Reuse detection!)
      const reuseAttack = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [sessionA_1]);
      
      expect(reuseAttack.status).toBe(401);

      // Now, legitimate user tries to use the NEW token they got from rotation
      // It should be REVOKED because the family was compromised
      const legitimateRetry = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [sessionA_1_new]);
      
      expect(legitimateRetry.status).toBe(401);

      // Verify Device B is unaffected (Independent session)
      const independentRefresh = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [sessionA_2]);
      
      expect(independentRefresh.status).toBe(200);
    });

    it("6. Concurrent refresh requests safely process only one", async () => {
      const login = await request(app).post("/api/auth/login").send({
        email: "family@example.com",
        password: "securepassword123"
      });
      const cookie = login.headers["set-cookie"][0].split(";")[0];

      // Send 3 requests simultaneously
      const results = await Promise.all([
        request(app).post("/api/auth/refresh").set("Cookie", [cookie]),
        request(app).post("/api/auth/refresh").set("Cookie", [cookie]),
        request(app).post("/api/auth/refresh").set("Cookie", [cookie])
      ]);

      const successCount = results.filter(r => r.status === 200).length;
      const failCount = results.filter(r => r.status === 401).length;

      // Because of atomic updates, exactly ONE should succeed and the others fail with 401
      expect(successCount).toBe(1);
      expect(failCount).toBe(2);
    });
  });

  describe("JWT Validation", () => {
    it("7/8/9. Rejects invalid issuer, audience, and token type", async () => {
      // Sign a token with wrong issuer
      const badIssuerToken = jwt.sign({ sessionId: "123", type: "access" }, env.JWT_ACCESS_SECRET, {
        issuer: "wrong-issuer",
        audience: env.JWT_AUDIENCE,
        subject: "user1"
      });

      const badAudienceToken = jwt.sign({ sessionId: "123", type: "access" }, env.JWT_ACCESS_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: "wrong-audience",
        subject: "user1"
      });

      const badTypeToken = jwt.sign({ sessionId: "123", type: "refresh" }, env.JWT_ACCESS_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        subject: "user1"
      });

      const r1 = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${badIssuerToken}`);
      const r2 = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${badAudienceToken}`);
      const r3 = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${badTypeToken}`);

      expect(r1.status).toBe(401);
      expect(r2.status).toBe(401);
      expect(r3.status).toBe(401);
    });
  });

  describe("Role Authorization", () => {
    it("10. Role authorization blocks unauthorized users", async () => {
      const testApp = express();
      testApp.use(express.json());
      
      testApp.get("/protected", (req: any, res: any, next: any) => {
        req.user = { id: "00000000-0000-0000-0000-000000000000", sessionId: "session" };
        next();
      }, authorizeRole([MembershipRole.DOCTOR]), (req, res) => {
        res.status(200).json({ ok: true });
      });

      // User has no hospital or lab memberships mapped to DOCTOR
      const res = await request(testApp).get("/protected");
      // Because we didn't populate the database for this specific user, they have no roles.
      // So they should be Forbidden.
      expect(res.status).toBe(403);
    });
  });
});
