import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { RecordCategory, RecordLifecycleStatus } from "../src/generated/prisma/enums.js";

const prisma = databaseClient.getClient();

describe("Medical Record Security", () => {
  let userA: { id: string; accessToken: string };
  let userB: { id: string; accessToken: string };
  let recordA_id: string;

  beforeAll(async () => {
    // Clean up
    await prisma.accessLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.medicalRecord.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "recordtest" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "recordtest" } } } });
    await prisma.user.deleteMany({ where: { email: { contains: "recordtest" } } });

    // Register User A
    const resA = await request(app).post("/api/auth/register")
      .set("X-Forwarded-For", "192.168.10.1")
      .send({
        email: "recordtestA@example.com",
        password: "securepassword123",
        firstName: "Alice",
        lastName: "A"
      });
    const loginA = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "192.168.10.1")
      .send({
        email: "recordtestA@example.com",
        password: "securepassword123",
      });
    userA = { id: resA.body.user.id, accessToken: loginA.body.accessToken };

    // Register User B
    const resB = await request(app).post("/api/auth/register")
      .set("X-Forwarded-For", "192.168.10.2")
      .send({
        email: "recordtestB@example.com",
        password: "securepassword123",
        firstName: "Bob",
        lastName: "B"
      });
    const loginB = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "192.168.10.2")
      .send({
        email: "recordtestB@example.com",
        password: "securepassword123",
      });
    userB = { id: resB.body.user.id, accessToken: loginB.body.accessToken };
  });

  afterAll(async () => {
    await prisma.accessLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { not: undefined } } });
    await prisma.medicalRecord.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "recordtest" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "recordtest" } } } });
    await prisma.user.deleteMany({ where: { email: { contains: "recordtest" } } });
  });

  it("10. Record creation creates correct ownership (User A)", async () => {
    const res = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        category: RecordCategory.LAB_REPORT,
        title: "Initial Blood Test",
        occurredAt: "2023-01-01T00:00:00Z"
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Initial Blood Test");
    expect(res.body.source).toBe("PATIENT");
    expect(res.body.provenanceStatus).toBe("PATIENT_UPLOADED");
    recordA_id = res.body.id;
  });

  it("1. Authenticated patient can list own records", async () => {
    const res = await request(app)
      .get("/api/patient/records")
      .set("Authorization", `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(recordA_id);
    expect(res.body.pagination.total).toBe(1);
  });

  it("2. Unauthenticated request is rejected", async () => {
    const res = await request(app).get("/api/patient/records");
    expect(res.status).toBe(401);
  });

  it("3. Patient cannot view another patient's record", async () => {
    const res = await request(app)
      .get(`/api/patient/records/${recordA_id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("4. Patient cannot update another patient's record", async () => {
    const res = await request(app)
      .patch(`/api/patient/records/${recordA_id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ title: "Hacked Title" });

    expect(res.status).toBe(404);
  });

  it("5. Patient cannot create a record for another patient", async () => {
    // The API determines ownership by `req.user.id`. Sending `patientId` in body is ignored by schema.
    const res = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({
        category: RecordCategory.CONSULTATION,
        title: "Sneaky Record",
        occurredAt: "2023-02-01T00:00:00Z",
        patientId: "some-other-id" // This should be ignored
      });

    expect(res.status).toBe(400); // 400 because `patientId` is strictly forbidden by `strict()` schema
  });

  it("6. Patient cannot spoof provider provenance", async () => {
    const res = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({
        category: RecordCategory.CONSULTATION,
        title: "Spoofed Record",
        occurredAt: "2023-02-01T00:00:00Z",
        source: "DOCTOR", // Not allowed by schema
        provenanceStatus: "PROVIDER_VERIFIED"
      });

    expect(res.status).toBe(400);
  });

  it("7. Invalid category is rejected", async () => {
    const res = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        category: "INVALID_CAT",
        title: "Bad Record",
        occurredAt: "2023-02-01T00:00:00Z"
      });

    expect(res.status).toBe(400);
  });

  it("8. Invalid record ID is rejected", async () => {
    const res = await request(app)
      .get("/api/patient/records/not-a-uuid")
      .set("Authorization", `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(400);
  });

  it("9. Pagination limits are enforced", async () => {
    const res = await request(app)
      .get("/api/patient/records?page=1&pageSize=999")
      .set("Authorization", `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(400); // Because max pageSize is 100
  });

  it("11. Audit event is created for upload", async () => {
    const audits = await prisma.auditLog.findMany({
      where: { targetId: recordA_id, action: "RECORD_UPLOADED" }
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("12. Record view is appropriately logged", async () => {
    // View record
    const viewRes = await request(app)
      .get(`/api/patient/records/${recordA_id}`)
      .set("Authorization", `Bearer ${userA.accessToken}`);
    
    expect(viewRes.status).toBe(200);

    const accessLogs = await prisma.accessLog.findMany({
      where: { resourceId: recordA_id, action: "VIEW" }
    });
    expect(accessLogs.length).toBeGreaterThanOrEqual(1);
    
    const audits = await prisma.auditLog.findMany({
      where: { targetId: recordA_id, action: "RECORD_VIEWED" }
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("13. Archived/revoked records behave according to the existing lifecycle rules", async () => {
    const resUpdate = await request(app)
      .patch(`/api/patient/records/${recordA_id}`)
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ lifecycleStatus: RecordLifecycleStatus.ARCHIVED });

    expect(resUpdate.status).toBe(200);
    expect(resUpdate.body.lifecycleStatus).toBe("ARCHIVED");

    // Re-fetch should show ARCHIVED
    const resFetch = await request(app)
      .get(`/api/patient/records/${recordA_id}`)
      .set("Authorization", `Bearer ${userA.accessToken}`);
    
    expect(resFetch.body.lifecycleStatus).toBe("ARCHIVED");
  });
});
