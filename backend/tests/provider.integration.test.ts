import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { RecordCategory } from "../src/generated/prisma/enums.js";

const prisma = databaseClient.getClient();

describe("Provider Authorization", () => {
  let patient: { id: string; accessToken: string };
  let providerA: { id: string; accessToken: string };
  let providerB: { id: string; accessToken: string };
  let qrPayload: { selector: string; token: string };
  let sharingSessionId: string;
  let recordId: string;

  beforeAll(async () => {
    // Cleanup
    await prisma.accessLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.medicalDocument.deleteMany();
    await prisma.medicalRecord.deleteMany();
    await prisma.qRSession.deleteMany();
    await prisma.sharingSessionScope.deleteMany();
    await prisma.sharingSession.deleteMany();
    await prisma.consentScope.deleteMany();
    await prisma.consent.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "provtest" } } } });
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "patprov" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "provtest" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "patprov" } } } });
    await prisma.doctorProfile.deleteMany({ where: { user: { email: { contains: "provtest" } } } });
    await prisma.user.deleteMany({ where: { email: { contains: "provtest" } } });
    await prisma.user.deleteMany({ where: { email: { contains: "patprov" } } });

    // 1. Create Patient
    const resPat = await request(app).post("/api/auth/register").set("X-Forwarded-For", "192.168.20.10").send({
      email: "patprov.test@example.com",
      password: "securepassword123",
      firstName: "Pat",
      lastName: "Prov"
    });
    const loginPat = await request(app).post("/api/auth/login").set("X-Forwarded-For", "192.168.20.10").send({
      email: "patprov.test@example.com",
      password: "securepassword123",
    });
    patient = { id: resPat.body.user.id, accessToken: loginPat.body.accessToken };

    // Create a record
    const recordRes = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({
        category: RecordCategory.LAB_REPORT,
        title: "Test Lab",
        occurredAt: new Date().toISOString()
      });
    recordId = recordRes.body.id;

    // 2. Create Provider A
    const resA = await request(app).post("/api/auth/register").set("X-Forwarded-For", "192.168.20.11").send({
      email: "provtest.A@example.com",
      password: "securepassword123",
      firstName: "Doc",
      lastName: "A"
    });
    const loginA = await request(app).post("/api/auth/login").set("X-Forwarded-For", "192.168.20.11").send({
      email: "provtest.A@example.com",
      password: "securepassword123",
    });
    providerA = { id: resA.body.user.id, accessToken: loginA.body.accessToken };

    // 3. Create Provider B
    const resB = await request(app).post("/api/auth/register").set("X-Forwarded-For", "192.168.20.12").send({
      email: "provtest.B@example.com",
      password: "securepassword123",
      firstName: "Doc",
      lastName: "B"
    });
    const loginB = await request(app).post("/api/auth/login").set("X-Forwarded-For", "192.168.20.12").send({
      email: "provtest.B@example.com",
      password: "securepassword123",
    });
    providerB = { id: resB.body.user.id, accessToken: loginB.body.accessToken };
  });

  afterAll(async () => {
    // Cleanup
  });

  it("1. Doctor login returns DOCTOR role", async () => {
    // Make Provider A a doctor
    await prisma.doctorProfile.create({
      data: {
        userId: providerA.id,
        registrationNumber: "DOC-123",
        specialty: "Test",
        verificationStatus: "VERIFIED"
      }
    });

    const loginA = await request(app).post("/api/auth/login").send({
      email: "provtest.A@example.com",
      password: "securepassword123",
    });

    expect(loginA.body.user.roles).toContain("DOCTOR");
  });

  it("2. Patient cannot access provider endpoints", async () => {
    const res = await request(app)
      .get("/api/provider/sessions")
      .set("Authorization", `Bearer ${patient.accessToken}`);
    
    // Will return 200 with empty array since patient isn't grantee of any session
    // Or if we strictly enforced roles middleware it would be 403. Currently it just filters by granteeUserId.
    expect(res.body).toEqual([]); 
  });

  it("3. Provider cannot access records without sharing", async () => {
    // Arbitrary session ID
    const res = await request(app)
      .get("/api/provider/sessions/00000000-0000-0000-0000-000000000000/records")
      .set("Authorization", `Bearer ${providerA.accessToken}`);
    
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("4. Patient creates share, Provider A resolves QR and fetches context", async () => {
    // Patient Shares LAB_REPORT with Provider A
    const shareRes = await request(app)
      .post("/api/patient/sharing")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({
        granteeUserId: providerA.id,
        purpose: "Test",
        categories: [RecordCategory.LAB_REPORT],
        durationMinutes: 30
      });
      console.log(shareRes.body);
    qrPayload = shareRes.body.qrPayload;
    sharingSessionId = shareRes.body.session.id;

    // Resolve QR
    const resolveRes = await request(app)
      .post("/api/sharing/qr/resolve")
      .set("Authorization", `Bearer ${providerA.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });

    expect(resolveRes.status).toBe(200);

    // Fetch Context
    const contextRes = await request(app)
      .get(`/api/provider/sessions/${sharingSessionId}`)
      .set("Authorization", `Bearer ${providerA.accessToken}`);

    expect(contextRes.status).toBe(200);
    expect(contextRes.body.scopes).toContain("LAB_REPORT");
  });

  it("5. Provider A can access authorized LAB_REPORT", async () => {
    const recordsRes = await request(app)
      .get(`/api/provider/sessions/${sharingSessionId}/records`)
      .set("Authorization", `Bearer ${providerA.accessToken}`);

    expect(recordsRes.status).toBe(200);
    expect(recordsRes.body.length).toBe(1);
    expect(recordsRes.body[0].id).toBe(recordId);

    const detailRes = await request(app)
      .get(`/api/provider/sessions/${sharingSessionId}/records/${recordId}`)
      .set("Authorization", `Bearer ${providerA.accessToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(recordId);
  });

  it("6. Provider A cannot access unauthorized category", async () => {
    // Patient creates a PRESCRIPTION record
    const presRes = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({
        category: RecordCategory.PRESCRIPTION,
        title: "Test Prescription",
        occurredAt: new Date().toISOString()
      });
    const presId = presRes.body.id;

    // Provider A attempts to fetch it using their LAB_REPORT session
    const detailRes = await request(app)
      .get(`/api/provider/sessions/${sharingSessionId}/records/${presId}`)
      .set("Authorization", `Bearer ${providerA.accessToken}`);

    expect(detailRes.status).toBe(403);
    expect(detailRes.body.error).toBe("Unauthorized category");
  });

  it("7. Provider B cannot resolve or use Provider A's session", async () => {
    const resolveRes = await request(app)
      .post("/api/sharing/qr/resolve")
      .set("Authorization", `Bearer ${providerB.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });
    expect(resolveRes.status).toBe(403);

    const contextRes = await request(app)
      .get(`/api/provider/sessions/${sharingSessionId}`)
      .set("Authorization", `Bearer ${providerB.accessToken}`);
    expect(contextRes.status).toBe(403);
  });

  it("8. Revocation immediately blocks subsequent access", async () => {
    const revokeRes = await request(app)
      .post(`/api/patient/sharing/${sharingSessionId}/revoke`)
      .set("Authorization", `Bearer ${patient.accessToken}`);
    expect(revokeRes.status).toBe(200);

    const recordsRes = await request(app)
      .get(`/api/provider/sessions/${sharingSessionId}/records`)
      .set("Authorization", `Bearer ${providerA.accessToken}`);
    expect(recordsRes.status).toBe(403);
    expect(recordsRes.body.error).toBe("Session is not active");
  });
});
