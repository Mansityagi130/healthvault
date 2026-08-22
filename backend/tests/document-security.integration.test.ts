import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
import { storage } from "../src/services/storage/LocalStorageProvider.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
import { v4 as uuidv4 } from "uuid";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
import fs from "fs/promises";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
import path from "path";
import { pollOutbox } from "../src/jobs/outbox-poller.js";
import { processAllMockJobs } from "../src/jobs/queue.js";

const prisma = databaseClient.getClient();

describe("Document Security & Quarantine Integration", () => {
  let token: string;
  let patientId: string;
  let userId: string;
  let recordId: string;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);

    const email = `docsec-${Date.now()}@sectest.com`;
    const regRes = await request(app).post("/api/auth/register").send({
      email,
      password: "Password123!",
      firstName: "Doc",
      lastName: "Sec"
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "Password123!"
    });
    token = loginRes.body.accessToken;
    userId = regRes.body.user.id;
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    patientId = profile!.id;

    // Create MedicalRecord
    const record = await prisma.medicalRecord.create({
      data: {
        patientId,
        category: "OTHER",
        source: "PATIENT",
        provenanceStatus: "PATIENT_UPLOADED",
        title: "Test Document Record",
        occurredAt: new Date(),
      }
    });
    recordId = record.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);

    // Cleanup
    });

  const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  // Fake PDF header for EICAR so it passes magic bytes
  const eicarPdf = Buffer.concat([
    Buffer.from("%PDF-1.4\n", "ascii"),
    Buffer.from(EICAR_SIGNATURE, "ascii")
  ]);

  const cleanPdf = Buffer.from("%PDF-1.4\nClean file content", "ascii");
  
  const failedScanPdf = Buffer.concat([
    Buffer.from("%PDF-1.4\n", "ascii"),
    Buffer.from("FAIL_SCAN_TEST", "ascii")
  ]);

  it("1. Clean file becomes CLEAN and promoted", async () => {
    const res = await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", cleanPdf, { filename: "clean.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.securityStatus).toBe("PENDING_SCAN");
    expect(res.body.storageKey).toMatch(/^quarantine\//);

    // Process background scan
    await pollOutbox();
    await processAllMockJobs();

    // Verify it updated in DB
    const dbDoc = await prisma.medicalDocument.findUnique({ where: { id: res.body.id } });
    expect(dbDoc!.securityStatus).toBe("CLEAN");
    expect(dbDoc!.storageKey).toMatch(/^approved\//);

    // verify we can download it
    const dlRes = await request(app)
      .get(`/api/patient/documents/${res.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers["x-content-type-options"]).toBe("nosniff");
    expect(dlRes.headers["content-security-policy"]).toBe("default-src 'none'");
  });

  it("2. EICAR fixture is detected and remains INFECTED", async () => {
    const res = await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", eicarPdf, { filename: "eicar.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.securityStatus).toBe("PENDING_SCAN");
    expect(res.body.storageKey).toMatch(/^quarantine\//);

    // Process background scan
    await pollOutbox();
    await processAllMockJobs();

    // Verify it updated in DB
    const dbDoc = await prisma.medicalDocument.findUnique({ where: { id: res.body.id } });
    expect(dbDoc!.securityStatus).toBe("INFECTED");
    expect(dbDoc!.scanResult).toBe("EICAR-TEST-SIGNATURE");
    expect(dbDoc!.storageKey).toMatch(/^quarantine\//);

    // verify we CANNOT download it
    const dlRes = await request(app)
      .get(`/api/patient/documents/${res.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(dlRes.status).toBe(403);
    expect(dlRes.body.error).toMatch(/security status/);
  });

  it("3. Scanner exception yields SCAN_FAILED", async () => {
    const res = await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", failedScanPdf, { filename: "fail.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.securityStatus).toBe("PENDING_SCAN");
    expect(res.body.storageKey).toMatch(/^quarantine\//);

    // Process background scan
    await pollOutbox();
    await processAllMockJobs();

    // Verify it updated in DB
    const dbDoc = await prisma.medicalDocument.findUnique({ where: { id: res.body.id } });
    expect(dbDoc!.securityStatus).toBe("SCAN_FAILED");
    expect(dbDoc!.storageKey).toMatch(/^quarantine\//);

    // verify we CANNOT download it
    const dlRes = await request(app)
      .get(`/api/patient/documents/${res.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(dlRes.status).toBe(403);
    expect(dlRes.body.error).toMatch(/security status/);
  });
});
