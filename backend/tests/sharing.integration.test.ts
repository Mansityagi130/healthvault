import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { RecordCategory } from "../src/generated/prisma/enums.js";

const prisma = databaseClient.getClient();

describe("Sharing & Consent Security", () => {
  let patient: { id: string; accessToken: string };
  let providerA: { id: string; accessToken: string };
  let providerB: { id: string; accessToken: string };
  let qrPayload: { selector: string; token: string };
  let sharingSessionId: string;

  beforeAll(async () => {
    // Cleanup DB to avoid unique constraint issues with fixtures
    await prisma.accessLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.qRSession.deleteMany();
    await prisma.sharingSessionScope.deleteMany();
    await prisma.sharingSession.deleteMany();
    await prisma.consentScope.deleteMany();
    await prisma.consent.deleteMany();
    await prisma.medicalDocument.deleteMany();
    await prisma.medicalRecord.deleteMany();
    await prisma.medicalDocument.deleteMany();
    await prisma.medicalRecord.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "test" } } } });
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "share" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "share" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "test" } } } });
    await prisma.doctorProfile.deleteMany({ where: { user: { email: { contains: "test" } } } });
    await prisma.hospitalMembership.deleteMany(); await prisma.user.deleteMany({ where: { email: { contains: "share" } } });
    await prisma.hospitalMembership.deleteMany(); await prisma.user.deleteMany({ where: { email: { contains: "test" } } });
    
    // Create patient
    const resPat = await request(app).post("/api/auth/register").set("X-Forwarded-For", "192.168.20.10").send({
      email: "patient.share@example.com",
      password: "securepassword123",
      firstName: "Patient",
      lastName: "Share"
    });
    const loginPat = await request(app).post("/api/auth/login").set("X-Forwarded-For", "192.168.20.10").send({
      email: "patient.share@example.com",
      password: "securepassword123",
    });
    patient = { id: resPat.body.user.id, accessToken: loginPat.body.accessToken };

    // Use fixture provider generation to get doctors
    const provRes = await request(app).get("/api/patient/providers/fixtures").set("Authorization", `Bearer ${patient.accessToken}`);
    const providers = provRes.body;
    
    // Create actual sessions for the providers so they can call authenticated routes
    // They were created in fixture with password "mocked_hash" so we can't login normally via API, we'll force token creation
    // For integration test, we can just login using a mock token, wait... We can't.
    // So let's create the providers directly via API instead of using the fixture logic just for the test's provider auth.
  });

  afterAll(async () => {
    // Cleanup
    await prisma.accessLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.qRSession.deleteMany();
    await prisma.sharingSessionScope.deleteMany();
    await prisma.sharingSession.deleteMany();
    await prisma.consentScope.deleteMany();
    await prisma.consent.deleteMany();
    await prisma.medicalDocument.deleteMany();
    await prisma.medicalRecord.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "test" } } } });
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "share" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "share" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "test" } } } });
    await prisma.doctorProfile.deleteMany({ where: { user: { email: { contains: "test" } } } });
    await prisma.hospitalMembership.deleteMany(); await prisma.user.deleteMany({ where: { email: { contains: "share" } } });
    await prisma.hospitalMembership.deleteMany(); await prisma.user.deleteMany({ where: { email: { contains: "test" } } });
  });

  it("0. Setup providers via API for test tokens", async () => {
    // Create Provider A
    const resA = await request(app).post("/api/auth/register").set("X-Forwarded-For", "192.168.20.11").send({
      email: "dr.testA@example.com",
      password: "securepassword123",
      firstName: "Doc",
      lastName: "TestA"
    });
    const loginA = await request(app).post("/api/auth/login").set("X-Forwarded-For", "192.168.20.11").send({
      email: "dr.testA@example.com",
      password: "securepassword123",
    });
    providerA = { id: resA.body.user.id, accessToken: loginA.body.accessToken };

    // Create Provider B
    const resB = await request(app).post("/api/auth/register").set("X-Forwarded-For", "192.168.20.12").send({
      email: "dr.testB@example.com",
      password: "securepassword123",
      firstName: "Doc",
      lastName: "TestB"
    });
    const loginB = await request(app).post("/api/auth/login").set("X-Forwarded-For", "192.168.20.12").send({
      email: "dr.testB@example.com",
      password: "securepassword123",
    });
    providerB = { id: resB.body.user.id, accessToken: loginB.body.accessToken };
  });

  it("1. Patient can create consent and get QR", async () => {
    const res = await request(app)
      .post("/api/patient/sharing")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({
        granteeUserId: providerA.id,
        purpose: "General checkup",
        categories: [RecordCategory.LAB_REPORT, RecordCategory.PRESCRIPTION],
        durationMinutes: 60
      });

    expect(res.status).toBe(201);
    expect(res.body.qrPayload.selector).toBeDefined();
    expect(res.body.qrPayload.token).toBeDefined();
    expect(res.body.session.id).toBeDefined();

    qrPayload = res.body.qrPayload;
    sharingSessionId = res.body.session.id;
  });

  it("2. Raw QR token is never stored", async () => {
    const qrSession = await prisma.qRSession.findUnique({
      where: { selector: qrPayload.selector }
    });
    expect(qrSession).toBeDefined();
    expect(qrSession!.tokenHash).not.toBe(qrPayload.token); // Should be hashed
    expect(qrSession!.tokenHash.length).toBeGreaterThan(32);
  });

  it("3. Provider A can resolve valid QR", async () => {
    const res = await request(app)
      .post("/api/sharing/qr/resolve")
      .set("Authorization", `Bearer ${providerA.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });

    expect(res.status).toBe(200);
    expect(res.body.sharingSessionId).toBe(sharingSessionId);
    expect(res.body.patientId).toBeDefined();
    expect(res.body.patientName).toBe("Patient Share");
    expect(res.body.scopes).toContain("LAB_REPORT");
    expect(res.body.scopes).toContain("PRESCRIPTION");
    // Ensure medical records are NOT returned
    expect(res.body.records).toBeUndefined();
  });

  it("4. Provider B cannot resolve Provider A's QR", async () => {
    const res = await request(app)
      .post("/api/sharing/qr/resolve")
      .set("Authorization", `Bearer ${providerB.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Unauthorized");
  });

  it("5. Invalid QR token is rejected", async () => {
    const res = await request(app)
      .post("/api/sharing/qr/resolve")
      .set("Authorization", `Bearer ${providerA.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: "invalid-token"
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("invalid or expired");
  });

  it("6. Revoking session instantly blocks QR", async () => {
    // Patient revokes
    const revokeRes = await request(app)
      .post(`/api/patient/sharing/${sharingSessionId}/revoke`)
      .set("Authorization", `Bearer ${patient.accessToken}`);
    
    expect(revokeRes.status).toBe(200);

    // Provider tries to scan again
    const scanRes = await request(app)
      .post("/api/sharing/qr/resolve")
      .set("Authorization", `Bearer ${providerA.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });

    expect(scanRes.status).toBe(403);
    expect(scanRes.body.error).toContain("invalid or expired");
  });
});
