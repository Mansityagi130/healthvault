import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { SmsProvider } from "../src/services/sms.provider.js";

const prisma = databaseClient.getClient();

describe("Phone OTP Verification Integration Flow", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);
    await databaseClient.disconnect();
  });

  let testUserId: string;
  const testPhone = "+919456071969";
  let userTokens: { accessToken: string; refreshTokenCookie: string };

  it("1. Registers a new patient with PENDING_VERIFICATION status", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "otp.patient@example.com",
        password: "securepassword123",
        firstName: "OTP",
        lastName: "Patient",
        phone: testPhone
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("verificationRequired", true);
    expect(res.body).toHaveProperty("userId");
    testUserId = res.body.userId;
  });

  it("2. Blocks standard login attempts for the pending verification user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "otp.patient@example.com",
        password: "securepassword123"
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("verificationRequired", true);
    expect(res.body.userId).toBe(testUserId);
  });

  it("3. Rejects invalid verification codes", async () => {
    const res = await request(app)
      .post("/api/auth/verify-phone")
      .send({
        userId: testUserId,
        otp: "000000"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid verification code");
  });

  it("4. Enforces 60 seconds resend cooldown", async () => {
    const res = await request(app)
      .post("/api/auth/resend-phone-otp")
      .send({ userId: testUserId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("wait 60 seconds");
  });

  it("5. Accepts correct OTP, activates the user, and auto-logs them in", async () => {
    const otp = SmsProvider.getMockOtp(testPhone);
    expect(otp).toBeDefined();

    const res = await request(app)
      .post("/api/auth/verify-phone")
      .send({
        userId: testUserId,
        otp: otp
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user.status).toBe("ACTIVE");
    expect(res.headers["set-cookie"]).toBeDefined();

    userTokens = {
      accessToken: res.body.accessToken,
      refreshTokenCookie: res.headers["set-cookie"][0].split(";")[0],
    };
  });

  it("6. Allows active verified user to perform standard requests", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${userTokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("ACTIVE");
  });
});
