import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { RecordCategory, RecordLifecycleStatus, RecordSource, ProvenanceStatus } from "../src/generated/prisma/enums.js";

const prisma = databaseClient.getClient();

describe("Patient ↔ Lab Association", () => {
  let patientA = { email: `pata_assoc_${Date.now()}@example.com`, password: "Password123!", id: "00000000-0000-0000-0000-000000000000", profileId: "00000000-0000-0000-0000-000000000000", accessToken: "" };
  let patientB = { email: `patb_assoc_${Date.now()}@example.com`, password: "Password123!", id: "00000000-0000-0000-0000-000000000000", profileId: "00000000-0000-0000-0000-000000000000", accessToken: "" };
  let labStaffA = { email: `staffa_assoc_${Date.now()}@example.com`, password: "Password123!", id: "00000000-0000-0000-0000-000000000000", accessToken: "" };
  let labStaffB = { email: `staffb_assoc_${Date.now()}@example.com`, password: "Password123!", id: "00000000-0000-0000-0000-000000000000", accessToken: "" };
  
  let labA: { id: string, name: string } = { id: "00000000-0000-0000-0000-000000000000", name: "" };
  let labB: { id: string, name: string } = { id: "00000000-0000-0000-0000-000000000000", name: "" };
  let qrPayload: { selector: string, token: string };
  let associationAId: string;

  beforeAll(async () => {
    // 1. Register users
    for (const u of [patientA, patientB, labStaffA, labStaffB]) {
      const res = await request(app).post("/api/auth/register").send({
        firstName: "Test",
        lastName: "User",
        email: u.email,
        password: u.password,
        dateOfBirth: "1990-01-01",
        sexAtBirth: "MALE"
      });
      u.id = res.body.user.id;
      const profile = await prisma.patientProfile.findUnique({ where: { userId: u.id } });
      if (profile) u.profileId = profile.id;
    }

    for (const u of [patientA, patientB, labStaffA, labStaffB]) {
      const res = await request(app).post("/api/auth/login").send({ email: u.email, password: u.password });
      u.accessToken = res.body.accessToken;
    }

    // 2. Create Labs
    labA = await prisma.lab.create({ data: { name: "Assoc Lab A" } });
    labB = await prisma.lab.create({ data: { name: "Assoc Lab B" } });

    // 3. Assign lab staff
    await prisma.labMembership.create({
      data: { labId: labA.id, userId: labStaffA.id, role: "LAB_ADMIN", status: "ACTIVE" }
    });
    await prisma.labMembership.create({
      data: { labId: labB.id, userId: labStaffB.id, role: "LAB_ADMIN", status: "ACTIVE" }
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.labResult.deleteMany({ where: { labReport: { labId: { in: [labA.id, labB.id] } } } });
    await prisma.labReport.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
    await prisma.medicalRecord.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
    await prisma.patientLabAssociation.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
    await prisma.labPairingToken.deleteMany({ where: { patientId: { in: [patientA.profileId, patientB.profileId] } } });
    await prisma.labMembership.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
    await prisma.lab.deleteMany({ where: { id: { in: [labA.id, labB.id] } } });
  });

  it("1. Unauthenticated user cannot create pairing", async () => {
    const res = await request(app).post("/api/patient/lab-associations/pairing-token");
    expect(res.status).toBe(401);
  });

  it("2. Patient can create pairing request", async () => {
    const res = await request(app)
      .post("/api/patient/lab-associations/pairing-token")
      .set("Authorization", `Bearer ${patientA.accessToken}`)
      .send({ expiresInMinutes: 15 });
    
    expect(res.status).toBe(201);
    expect(res.body.selector).toBeDefined();
    expect(res.body.token).toBeDefined();
    qrPayload = res.body;
  });

  it("3. Raw token is never stored", async () => {
    const tokenRecord = await prisma.labPairingToken.findUnique({
      where: { selector: qrPayload.selector }
    });
    expect(tokenRecord).toBeDefined();
    expect(tokenRecord?.tokenHash).toBeDefined();
    expect(tokenRecord?.tokenHash).not.toBe(qrPayload.token);
  });

  it("4. Wrong Lab cannot resolve pairing (fails if no lab membership)", async () => {
    const res = await request(app)
      .post(`/api/labs/${labA.id}/associations/consume`)
      .set("Authorization", `Bearer ${labStaffB.accessToken}`) // wrong staff
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });
    expect(res.status).toBe(403);
  });

  it("5. Lab can resolve valid pairing", async () => {
    const res = await request(app)
      .post(`/api/labs/${labA.id}/associations/consume`)
      .set("Authorization", `Bearer ${labStaffA.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });
    expect(res.status).toBe(200);
    expect(res.body.associationId).toBeDefined();
    associationAId = res.body.associationId;
  });

  it("6. Replayed token is rejected", async () => {
    const res = await request(app)
      .post(`/api/labs/${labA.id}/associations/consume`)
      .set("Authorization", `Bearer ${labStaffA.accessToken}`)
      .send({
        selector: qrPayload.selector,
        token: qrPayload.token
      });
    expect(res.status).toBe(400); // Because token is deleted on first consume
  });

  it("7. Patient must explicitly approve (Lab Report creation fails while PENDING)", async () => {
    // Association is currently PENDING
    const res = await request(app)
      .post(`/api/labs/${labA.id}/reports`)
      .set("Authorization", `Bearer ${labStaffA.accessToken}`)
      .send({
        patientId: patientA.profileId,
        title: "Test Report"
      });
    expect(res.status).toBe(403);
  });

  it("8. Patient can explicitly approve", async () => {
    const res = await request(app)
      .post("/api/patient/lab-associations/approve")
      .set("Authorization", `Bearer ${patientA.accessToken}`)
      .send({ associationId: associationAId });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ACTIVE");
  });

  it("9. Duplicate active association is prevented", async () => {
    // If patient approves again, it should fail
    const res = await request(app)
      .post("/api/patient/lab-associations/approve")
      .set("Authorization", `Bearer ${patientA.accessToken}`)
      .send({ associationId: associationAId });
    expect(res.status).toBe(400); // Already ACTIVE, not PENDING
  });

  it("10. Active association permits authorized LabReport creation", async () => {
    const res = await request(app)
      .post(`/api/labs/${labA.id}/reports`)
      .set("Authorization", `Bearer ${labStaffA.accessToken}`)
      .send({
        patientId: patientA.profileId,
        title: "Test Report"
      });
    expect(res.status).toBe(201);
  });

  it("11. Patient can revoke association", async () => {
    const res = await request(app)
      .post("/api/patient/lab-associations/revoke")
      .set("Authorization", `Bearer ${patientA.accessToken}`)
      .send({ associationId: associationAId });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REVOKED");
  });

  it("12. Revoked association blocks new LabReport creation", async () => {
    const res = await request(app)
      .post(`/api/labs/${labA.id}/reports`)
      .set("Authorization", `Bearer ${labStaffA.accessToken}`)
      .send({
        patientId: patientA.profileId,
        title: "Test Report 2"
      });
    expect(res.status).toBe(403);
  });
});
