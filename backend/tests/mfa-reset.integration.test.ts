import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { generate } from "otplib";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";

const prisma = databaseClient.getClient();

function extractTokenFromOutbox(payload: unknown): string {
  const p = payload as { message?: string };
  return (p.message || "").split("token=")[1];
}

describe("MFA & Password Reset Integration Tests", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "PasswordResetToken", "AuditLog", "OutboxEvent" CASCADE;`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "PasswordResetToken", "AuditLog", "OutboxEvent" CASCADE;`);
    await databaseClient.disconnect();
  });

  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;
  let mfaSecretA: string;
  let pendingMfaToken: string;
  let backupCodes: string[] = [];

  it("0. Pre-requisite setup (create User A and User B)", async () => {
    const resA = await request(app).post("/api/auth/register").send({
      email: "usera@example.com",
      password: "Password123!",
      firstName: "User",
      lastName: "A"
    });
    expect(resA.status).toBe(201);
    userAId = resA.body.user.id;

    const resB = await request(app).post("/api/auth/register").send({
      email: "userb@example.com",
      password: "Password123!",
      firstName: "User",
      lastName: "B"
    });
    expect(resB.status).toBe(201);
    userBId = resB.body.user.id;

    // Login to get tokens
    const loginA = await request(app).post("/api/auth/login").send({
      email: "usera@example.com",
      password: "Password123!"
    });
    userAToken = loginA.body.accessToken;

    const loginB = await request(app).post("/api/auth/login").send({
      email: "userb@example.com",
      password: "Password123!"
    });
    userBToken = loginB.body.accessToken;
  });

  it("1. MFA enrollment setup", async () => {
    const res = await request(app)
      .post("/api/auth/mfa/enroll")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("secret");
    expect(res.body).toHaveProperty("otpauth");
    mfaSecretA = res.body.secret;
  });

  it("2. Invalid enrollment OTP", async () => {
    const res = await request(app)
      .post("/api/auth/mfa/confirm")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid verification code");
  });

  it("3. Successful MFA enablement", async () => {
    const code = await generate({ secret: mfaSecretA });
    const res = await request(app)
      .post("/api/auth/mfa/confirm")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ code });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("backupCodes");
    expect(res.body.backupCodes).toHaveLength(10);
    backupCodes = res.body.backupCodes;

    const user = await prisma.user.findUnique({ where: { id: userAId } });
    expect(user!.mfaEnabled).toBe(true);
    expect(user!.mfaSecret).not.toBeNull();
    expect(user!.mfaSecret).not.toBe(mfaSecretA); // Encrypted
  });

  it("4. MFA login challenge", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "usera@example.com", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body).toHaveProperty("mfaToken");
    pendingMfaToken = res.body.mfaToken;
  });

  it("5. Invalid MFA code login", async () => {
    const res = await request(app)
      .post("/api/auth/login/mfa")
      .send({ mfaToken: pendingMfaToken, code: "000000" });

    expect(res.status).toBe(401);
  });

  it("6. Successful MFA login", async () => {
    const code = await generate({ secret: mfaSecretA });
    const res = await request(app)
      .post("/api/auth/login/mfa")
      .send({ mfaToken: pendingMfaToken, code });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    userAToken = res.body.accessToken;
  });

  it("7. MFA token cannot access medical APIs", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "usera@example.com", password: "Password123!" });

    const tempToken = loginRes.body.mfaToken;

    const accessRes = await request(app)
      .get("/api/patient/records")
      .set("Authorization", `Bearer ${tempToken}`);

    expect(accessRes.status).toBe(401);
  });

  it("8. Recovery code login", async () => {
    // Generate new login challenge
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "usera@example.com", password: "Password123!" });
    const tempToken = loginRes.body.mfaToken;

    const backupCode = backupCodes[0];
    const res = await request(app)
      .post("/api/auth/login/mfa")
      .send({ mfaToken: tempToken, code: backupCode });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    userAToken = res.body.accessToken;
  });

  it("9. Recovery code single-use enforcement", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "usera@example.com", password: "Password123!" });
    const tempToken = loginRes.body.mfaToken;

    // Try to reuse the first code (backupCodes[0])
    const backupCode = backupCodes[0];
    const res = await request(app)
      .post("/api/auth/login/mfa")
      .send({ mfaToken: tempToken, code: backupCode });

    expect(res.status).toBe(401); // Already consumed
  });

  it("10. Recovery-code regeneration invalidation", async () => {
    // Perform step up verification to get step-up token
    const stepUpRes = await request(app)
      .post("/api/auth/step-up/verify")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ password: "Password123!", code: await generate({ secret: mfaSecretA }) });
    
    expect(stepUpRes.status).toBe(200);
    const stepUpToken = stepUpRes.body.stepUpToken;

    // Regenerate
    const regen = await request(app)
      .post("/api/auth/mfa/recovery-codes")
      .set("Authorization", `Bearer ${userAToken}`)
      .set("x-step-up-token", stepUpToken);

    expect(regen.status).toBe(200);
    expect(regen.body.backupCodes).toHaveLength(10);
    const newBackupCodes = regen.body.backupCodes;

    // Old backupCodes[1] should now be invalid
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "usera@example.com", password: "Password123!" });
    const tempToken = loginRes.body.mfaToken;

    const oldCodeRes = await request(app)
      .post("/api/auth/login/mfa")
      .send({ mfaToken: tempToken, code: backupCodes[1] });
    expect(oldCodeRes.status).toBe(401);

    // New code should work
    const newCodeRes = await request(app)
      .post("/api/auth/login/mfa")
      .send({ mfaToken: tempToken, code: newBackupCodes[0] });
    expect(newCodeRes.status).toBe(200);
    userAToken = newCodeRes.body.accessToken;
  });

  it("11. MFA disable requiring step-up", async () => {
    const res = await request(app)
      .post("/api/auth/mfa/disable")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(403); // Missing step up

    const stepUpRes = await request(app)
      .post("/api/auth/step-up/verify")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ password: "Password123!", code: await generate({ secret: mfaSecretA }) });
    const stepUpToken = stepUpRes.body.stepUpToken;

    const disableRes = await request(app)
      .post("/api/auth/mfa/disable")
      .set("Authorization", `Bearer ${userAToken}`)
      .set("x-step-up-token", stepUpToken);
    expect(disableRes.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userAId } });
    expect(user!.mfaEnabled).toBe(false);
  });

  it("12. Password change", async () => {
    const res = await request(app)
      .post("/api/auth/settings/password")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ currentPassword: "Password123!", newPassword: "NewPassword123!" });

    expect(res.status).toBe(200);
  });

  it("13. Password reuse rejection", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "usera@example.com",
      password: "NewPassword123!"
    });
    userAToken = loginRes.body.accessToken;

    const res = await request(app)
      .post("/api/auth/settings/password")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ currentPassword: "NewPassword123!", newPassword: "NewPassword123!" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("same as the current");
  });

  it("14. Forgot-password account enumeration protection", async () => {
    const resExist = await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "usera@example.com" });
    expect(resExist.status).toBe(200);
    expect(resExist.body.message).toContain("If the account exists");

    const resNonexist = await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "nonexistent@example.com" });
    expect(resNonexist.status).toBe(200);
    expect(resNonexist.body.message).toContain("If the account exists");
  });

  it("15. Reset token hashing & outbox verification", async () => {
    // Reset requested for User B
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "userb@example.com" });

    const outbox = await prisma.outboxEvent.findFirst({
      where: { topic: "NOTIFICATION" },
      orderBy: { createdAt: "desc" }
    });

    const token = extractTokenFromOutbox(outbox!.payload);
    
    // Hash token to verify DB has hash only
    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const dbToken = await prisma.passwordResetToken.findFirst({
      where: { userId: userBId },
      orderBy: { createdAt: "desc" }
    });

    expect(dbToken!.tokenHash).toBe(hashed);
    // Explicitly verify the plaintext token does not exist in any string field of the record
    expect(JSON.stringify(dbToken)).not.toContain(token);
  });

  it("16. Reset token expiration", async () => {
    // Create an expired token in DB
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: userBId,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000) // expired 1s ago
      }
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "ExpiredPass123!" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("expired");
  });

  it("17. Reset token single-use", async () => {
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "userb@example.com" });

    const outbox = await prisma.outboxEvent.findFirst({
      where: { topic: "NOTIFICATION" },
      orderBy: { createdAt: "desc" }
    });

    const token = extractTokenFromOutbox(outbox!.payload);

    const firstUse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "UserBNewPassword123!" });
    expect(firstUse.status).toBe(200);

    const secondUse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "UserBNewPassword123!" });
    expect(secondUse.status).toBe(400);
  });

  it("18. Concurrent reset-token redemption", async () => {
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "userb@example.com" });

    const outbox = await prisma.outboxEvent.findFirst({
      where: { topic: "NOTIFICATION" },
      orderBy: { createdAt: "desc" }
    });

    const token = extractTokenFromOutbox(outbox!.payload);

    // Fire parallel requests
    const promises = [
      request(app).post("/api/auth/reset-password").send({ token, newPassword: "PassConcurrent123!" }),
      request(app).post("/api/auth/reset-password").send({ token, newPassword: "PassConcurrent123!" })
    ];

    const results = await Promise.all(promises);
    const successes = results.filter(r => r.status === 200);
    expect(successes.length).toBe(1); // Exactly one should succeed
  });

  it("19. New reset invalidating old reset tokens", async () => {
    // Request first reset
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "userb@example.com" });
    const outbox1 = await prisma.outboxEvent.findFirst({
      where: { topic: "NOTIFICATION" },
      orderBy: { createdAt: "desc" }
    });
    const token1 = extractTokenFromOutbox(outbox1!.payload);

    // Request second reset
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "userb@example.com" });
    const outbox2 = await prisma.outboxEvent.findFirst({
      where: { topic: "NOTIFICATION" },
      orderBy: { createdAt: "desc" }
    });
    const token2 = extractTokenFromOutbox(outbox2!.payload);

    // First should fail
    const res1 = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: token1, newPassword: "NewValidPassword123!" });
    expect(res1.status).toBe(400);

    // Second should succeed
    const res2 = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: token2, newPassword: "NewValidPassword123!" });
    expect(res2.status).toBe(200);
  });

  it("20. Password reset revoking all sessions", async () => {
    // Login to create session
    const login = await request(app).post("/api/auth/login").send({
      email: "userb@example.com",
      password: "NewValidPassword123!"
    });
    const cookies = login.headers["set-cookie"];
    const oldSessionToken = login.body.accessToken;

    // Check if session works (use patient profile view since it verifies access token role)
    const checkBefore = await request(app)
      .get("/api/patient/records")
      .set("Authorization", `Bearer ${oldSessionToken}`);
    expect(checkBefore.status).toBe(200);

    // Request forgot password
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "userb@example.com" });
    const outbox = await prisma.outboxEvent.findFirst({
      where: { topic: "NOTIFICATION" },
      orderBy: { createdAt: "desc" }
    });
    const token = extractTokenFromOutbox(outbox!.payload);

    // Reset password
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "FullyRevokedPassword123!" });

    // Refresh should fail (returns 401)
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies);
    expect(refreshRes.status).toBe(401);
  });

  it("21. Rate limiting check", async () => {
    // Make multiple quick login attempts with X-Forwarded-For 192.168.4.1
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", "192.168.4.1")
          .send({ email: "usera@example.com", password: "WrongPassword" })
      );
    }

    const results = await Promise.all(promises);
    const rateLimited = results.some(r => r.status === 429);
    expect(rateLimited).toBe(true);
  });

  it("22. Cross-user reset-token rejection", async () => {
    // Reset requested for User A (email usera@example.com)
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ identity: "usera@example.com" });

    const outbox = await prisma.outboxEvent.findFirst({
      where: { topic: "NOTIFICATION" },
      orderBy: { createdAt: "desc" }
    });

    const token = extractTokenFromOutbox(outbox!.payload);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "UserAPasswordNew123!" });

    // Login for User B with that password should fail
    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ email: "userb@example.com", password: "UserAPasswordNew123!" });
    expect(loginB.status).toBe(401);
  });

  it("23. Audit-log safety (no secrets/passwords)", async () => {
    const logs = await prisma.auditLog.findMany();
    for (const log of logs) {
      const metaStr = JSON.stringify(log.metadata || {});
      expect(metaStr).not.toContain("Password123!");
      expect(metaStr).not.toContain("NewPassword123!");
      expect(metaStr).not.toContain("FullyRevokedPassword123!");
      const hasHex64 = /[0-9a-f]{64}/i.test(metaStr);
      expect(hasHex64).toBe(false);
    }
  });

  it("24. Notification safety (no credentials/secrets)", async () => {
    const outbox = await prisma.outboxEvent.findMany({
      where: { topic: "NOTIFICATION" }
    });
    for (const evt of outbox) {
      const payloadStr = JSON.stringify(evt.payload || {});
      expect(payloadStr).not.toContain("Password123!");
      expect(payloadStr).not.toContain("NewPassword123!");
      expect(payloadStr).not.toContain("mfaSecret");
    }
  });

  it("27. Existing authorization regression", async () => {
    // Check normal access with userB token (who logged in after password reset)
    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ email: "userb@example.com", password: "FullyRevokedPassword123!" });
    userBToken = loginB.body.accessToken;

    const accessRes = await request(app)
      .get("/api/patient/records")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(accessRes.status).toBe(200);
  });
});
