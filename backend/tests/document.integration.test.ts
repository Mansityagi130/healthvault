import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { RecordCategory } from "../src/generated/prisma/enums.js";
import fs from "fs/promises";
import path from "path";
import { pollOutbox } from "../src/jobs/outbox-poller.js";
import { processAllMockJobs } from "../src/jobs/queue.js";

const prisma = databaseClient.getClient();

describe("Document Upload & Security", () => {
  let userA: { id: string; accessToken: string };
  let userB: { id: string; accessToken: string };
  let recordA_id: string;
  let documentA_id: string;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);

    // Setup Patient A
    const resRegA = await request(app).post("/api/auth/register").send({
      email: `patientA-${Date.now()}@example.com`,
      password: "Password123!",
      firstName: "Patient",
      lastName: "A",
      role: "PATIENT"
    });
    const resA = await request(app).post("/api/auth/login").send({
      email: resRegA.body.user.email,
      password: "Password123!"
    });
    userA = { id: resA.body.user.id, accessToken: resA.body.accessToken };

    // Setup Patient B
    const resRegB = await request(app).post("/api/auth/register").send({
      email: `patientB-${Date.now()}@example.com`,
      password: "Password123!",
      firstName: "Patient",
      lastName: "B",
      role: "PATIENT"
    });
    const resB = await request(app).post("/api/auth/login").send({
      email: resRegB.body.user.email,
      password: "Password123!"
    });
    userB = { id: resB.body.user.id, accessToken: resB.body.accessToken };

    // Create a record for A
    const recRes = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        category: RecordCategory.LAB_REPORT,
        title: "Test Record for Doc",
        occurredAt: "2023-01-01T00:00:00Z"
      });
    recordA_id = recRes.body.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);

    // Cleanup DB
    // Cleanup storage files if any
    try {
      await fs.rm(path.join(process.cwd(), "storage/patients"), { recursive: true, force: true });
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    } catch (e) { /* ignore */ }
  });

  it("1. Patient can upload a valid document to own record", async () => {
    // Create a dummy PDF with magic bytes %PDF
    const pdfBuffer = Buffer.from("%PDF-1.4\n%...\nEOF");
    
    const res = await request(app)
      .post(`/api/patient/records/${recordA_id}/documents`)
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .attach("file", pdfBuffer, {
        filename: "test.pdf",
        contentType: "application/pdf"
      });

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe("application/pdf");
    expect(res.body.originalFilename).toBe("test.pdf");
    documentA_id = res.body.id;

    // Process the background job to promote the document to CLEAN
    await pollOutbox();
    await processAllMockJobs();
  });

  it("2. Patient cannot upload to another patient's record", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4\n%...\nEOF");
    
    const res = await request(app)
      .post(`/api/patient/records/${recordA_id}/documents`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .attach("file", pdfBuffer, {
        filename: "hacked.pdf",
        contentType: "application/pdf"
      });

    expect(res.status).toBe(404);
  });

  it("3. Patient can view own document", async () => {
    const res = await request(app)
      .get(`/api/patient/documents/${documentA_id}`)
      .set("Authorization", `Bearer ${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.toString()).toContain("%PDF-1.4");
  });

  it("4. Patient cannot view another patient's document", async () => {
    const res = await request(app)
      .get(`/api/patient/documents/${documentA_id}`)
      .set("Authorization", `Bearer ${userB.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("5. Invalid MIME type rejected", async () => {
    const txtBuffer = Buffer.from("Hello world");
    
    const res = await request(app)
      .post(`/api/patient/records/${recordA_id}/documents`)
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .attach("file", txtBuffer, {
        filename: "test.txt",
        contentType: "text/plain"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid file type");
  });

  it("6. Invalid file signature rejected", async () => {
    // Correct MIME type, but invalid magic bytes (fake PDF)
    const fakePdfBuffer = Buffer.from("Not a PDF actually");
    
    const res = await request(app)
      .post(`/api/patient/records/${recordA_id}/documents`)
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .attach("file", fakePdfBuffer, {
        filename: "fake.pdf",
        contentType: "application/pdf"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("File signature validation failed");
  });
});
