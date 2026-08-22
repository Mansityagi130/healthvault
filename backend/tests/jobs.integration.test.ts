import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { pollOutbox } from "../src/jobs/outbox-poller.js";
import { processAllMockJobs, getMockJobs, backgroundQueue } from "../src/jobs/queue.js";

const prisma = databaseClient.getClient();

describe("Background Jobs, Retries, and Security integration", () => {
  let token: string;
  let patientId: string;
  let userId: string;
  let recordId: string;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);

    const email = `jobtest-${Date.now()}@jobtest.com`;
    const regRes = await request(app).post("/api/auth/register").send({
      email,
      password: "Password123!",
      firstName: "Job",
      lastName: "Test"
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "Password123!"
    });
    token = loginRes.body.accessToken;
    userId = regRes.body.user.id;
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    patientId = profile!.id;

    const record = await prisma.medicalRecord.create({
      data: {
        patientId,
        category: "OTHER",
        source: "PATIENT",
        provenanceStatus: "PATIENT_UPLOADED",
        title: "Test Job Record",
        occurredAt: new Date(),
      }
    });
    recordId = record.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);
  });

  it("1. Job creation & quarantine enforcement", async () => {
    const cleanPdf = Buffer.from("%PDF-1.4\nClean file content", "ascii");
    const res = await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", cleanPdf, { filename: "clean.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.securityStatus).toBe("PENDING_SCAN");

    // Quarantine check - should fail download
    const dlRes = await request(app)
      .get(`/api/patient/documents/${res.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(dlRes.status).toBe(403);

    // Verify outbox event exists
    const events = await prisma.outboxEvent.findMany({ where: { status: 'PENDING' } });
    expect(events.length).toBeGreaterThan(0);

    // Process jobs
    await pollOutbox();
    await processAllMockJobs();

    // Verify CLEAN status and promotion
    const dbDoc = await prisma.medicalDocument.findUnique({ where: { id: res.body.id } });
    expect(dbDoc!.securityStatus).toBe("CLEAN");
  });

  it("2. Infected document rejection", async () => {
    const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    const eicarPdf = Buffer.concat([
      Buffer.from("%PDF-1.4\n", "ascii"),
      Buffer.from(EICAR_SIGNATURE, "ascii")
    ]);

    const res = await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", eicarPdf, { filename: "infected.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    
    await pollOutbox();
    await processAllMockJobs();

    const dbDoc = await prisma.medicalDocument.findUnique({ where: { id: res.body.id } });
    expect(dbDoc!.securityStatus).toBe("INFECTED");
  });

  it("3. ABDM transaction lifecycle & consent validation", async () => {
    const res = await request(app)
      .post('/api/interoperability/abdm/consent/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ abhaAddress: 'test@abdm', purpose: 'Clinical Review' });
    
    expect(res.status).toBe(200);
    expect(res.body.transaction.status).toBe('REQUESTED');

    await pollOutbox();
    await processAllMockJobs();

    const dbTx = await prisma.externalExchangeTransaction.findUnique({
      where: { id: res.body.transaction.id }
    });
    expect(dbTx!.status).toBe('COMPLETED');
  });

  it("4. Queue failure behavior (jobs remain in outbox)", async () => {
    const originalAdd = backgroundQueue.add;
    backgroundQueue.add = async () => {
      throw new Error("Redis connection lost");
    };

    const cleanPdf = Buffer.from("%PDF-1.4\nClean file content", "ascii");
    await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", cleanPdf, { filename: "clean.pdf", contentType: "application/pdf" });

    await pollOutbox();

    const failedEvent = await prisma.outboxEvent.findFirst({
      where: { status: 'FAILED' }
    });
    expect(failedEvent).not.toBeNull();
    expect(failedEvent!.error).toContain("Redis connection lost");

    backgroundQueue.add = originalAdd;
  });

  it("5. Duplicate job execution (idempotency checks)", async () => {
    const cleanPdf = Buffer.from("%PDF-1.4\nClean file content", "ascii");
    await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", cleanPdf, { filename: "clean.pdf", contentType: "application/pdf" });

    const event = await prisma.outboxEvent.findFirst({
      where: { status: 'PENDING' }
    });

    await backgroundQueue.add(event!.topic, event!.payload, { jobId: `outbox-${event!.id}` });
    await backgroundQueue.add(event!.topic, event!.payload, { jobId: `outbox-${event!.id}` });

    expect(getMockJobs().filter(j => j.id === `outbox-${event!.id}`).length).toBe(1);
  });
});
