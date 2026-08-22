import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { EncounterStatus } from "../src/generated/prisma/client.js";

const prisma = databaseClient.getClient();

describe("Provider-Created Clinical Records", () => {
  let providerA: unknown;
  let providerB: unknown;
  let patientA: unknown;
  let patientB: unknown;
  let hospitalA: unknown;
  let encounterA: unknown; // Assigned to providerA
  let encounterB: unknown; // Completed encounter

  const timePrefix = Date.now();
  let ipCounter = 200;

  async function createPatient(email: string) {
    const ip = `10.10.0.${ipCounter++}`;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    const res = await request(app).post("/api/auth/register").set("X-Forwarded-For", ip).send({
      email, password: "password123", firstName: "Pat", lastName: "ient"
    });
    const user = await prisma.user.findUnique({ where: { email } });
    const profile = await prisma.patientProfile.findUnique({ where: { userId: user!.id } });
    const auth = await request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email, password: "password123" });
    return { ...user, profileId: profile!.id, accessToken: auth.body.accessToken };
  }

  async function createProvider(email: string, license: string) {
    const ip = `10.10.0.${ipCounter++}`;
    await request(app).post("/api/auth/register").set("X-Forwarded-For", ip).send({
      email, password: "password123", role: "PROVIDER", firstName: "Dr", lastName: "Who", medicalLicenseNumber: license
    });
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.doctorProfile.create({ data: { userId: user!.id, registrationNumber: license, specialty: "General" } });
    const auth = await request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email, password: "password123" });
    return { ...user, accessToken: auth.body.accessToken };
  }

  beforeAll(async () => {
    providerA = await createProvider(`docA_${timePrefix}@example.com`, `DOCA_${timePrefix}`);
    providerB = await createProvider(`docB_${timePrefix}@example.com`, `DOCB_${timePrefix}`);
    patientA = await createPatient(`patA_${timePrefix}@example.com`);
    patientB = await createPatient(`patB_${timePrefix}@example.com`);

    hospitalA = await prisma.hospital.create({
      data: { name: "Clinical Test Hospital", code: `CTH_${timePrefix}` }
    });

    // Make providerA active member
    await prisma.hospitalMembership.create({
      data: { hospitalId: hospitalA.id, userId: providerA.id, role: "DOCTOR", status: "ACTIVE" }
    });

    // Encounter A - Active, assigned to providerA
    encounterA = await prisma.encounter.create({
      data: {
        patientId: patientA.profileId,
        hospitalId: hospitalA.id,
        providerId: providerA.id,
        type: "OUTPATIENT",
        status: EncounterStatus.ACTIVE,
        startedAt: new Date()
      }
    });

    // Encounter B - Completed, assigned to providerA
    encounterB = await prisma.encounter.create({
      data: {
        patientId: patientA.profileId,
        hospitalId: hospitalA.id,
        providerId: providerA.id,
        type: "OUTPATIENT",
        status: EncounterStatus.COMPLETED,
        startedAt: new Date(Date.now() - 100000),
        endedAt: new Date()
      }
    });
  });

  afterAll(async () => {
    await prisma.prescriptionItem.deleteMany({ where: { prescription: { medicalRecord: { encounterId: { in: [encounterA.id, encounterB.id] } } } } });
    await prisma.prescription.deleteMany({ where: { medicalRecord: { encounterId: { in: [encounterA.id, encounterB.id] } } } });
    await prisma.consultation.deleteMany({ where: { medicalRecord: { encounterId: { in: [encounterA.id, encounterB.id] } } } });
    await prisma.medicalRecord.deleteMany({ where: { encounterId: { in: [encounterA.id, encounterB.id] } } });
    await prisma.encounter.deleteMany({ where: { id: { in: [encounterA.id, encounterB.id] } } });
    await prisma.hospitalMembership.deleteMany({ where: { hospitalId: hospitalA.id } });
    await prisma.hospital.deleteMany({ where: { id: hospitalA.id } });
    const allIds = [providerA?.id, providerB?.id, patientA?.id, patientB?.id].filter(Boolean) as string[];
    await prisma.patientProfile.deleteMany({ where: { userId: { in: allIds } } });
    await prisma.doctorProfile.deleteMany({ where: { userId: { in: allIds } } });
    await prisma.user.deleteMany({ where: { id: { in: allIds } } });
  });

  it("1. Doctor creates consultation for assigned encounter", async () => {
    const res = await request(app)
      .post(`/api/provider/encounters/${encounterA.id}/consultations`)
      .set("Authorization", `Bearer ${providerA.accessToken}`)
      .send({
        chiefComplaint: "Headache",
        clinicalNotes: "Patient has had a headache for 3 days.",
        assessment: "Tension headache",
        plan: "Rest and hydration"
      });

    expect(res.status).toBe(201);
    expect(res.body.provenanceStatus).toBe("PROVIDER_CREATED");
    expect(res.body.source).toBe("DOCTOR");
    expect(res.body.consultation).toBeDefined();
    expect(res.body.consultation.clinicalSummary.chiefComplaint).toBe("Headache");
  });

  it("2. Doctor creates prescription for assigned encounter", async () => {
    const res = await request(app)
      .post(`/api/provider/encounters/${encounterA.id}/prescriptions`)
      .set("Authorization", `Bearer ${providerA.accessToken}`)
      .send({
        instructions: "Take with food",
        items: [
          { medicationName: "Ibuprofen", dosage: "400mg", frequency: "QDS", duration: "3 days" }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.provenanceStatus).toBe("PROVIDER_CREATED");
    expect(res.body.prescription).toBeDefined();
    expect(res.body.prescription.items.length).toBe(1);
    expect(res.body.prescription.items[0].medicationName).toBe("Ibuprofen");
  });

  it("3. Doctor cannot create record for unassigned or unauthorized encounter", async () => {
    const res = await request(app)
      .post(`/api/provider/encounters/${encounterA.id}/consultations`)
      .set("Authorization", `Bearer ${providerB.accessToken}`)
      .send({
        chiefComplaint: "Hacking attempts",
        clinicalNotes: "Trying to hack",
        assessment: "Hacker",
        plan: "Jail"
      });

    expect(res.status).toBe(403);
  });

  it("4. Doctor cannot create record after encounter completion", async () => {
    const res = await request(app)
      .post(`/api/provider/encounters/${encounterB.id}/consultations`)
      .set("Authorization", `Bearer ${providerA.accessToken}`)
      .send({
        chiefComplaint: "Too late",
        clinicalNotes: "Encounter is closed",
        assessment: "Closed",
        plan: "Nothing"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ACTIVE/);
  });

  it("5. Patient cannot spoof provenance", async () => {
    const res = await request(app)
      .post(`/api/patient/records`)
      .set("Authorization", `Bearer ${patientA.accessToken}`)
      .send({
        category: "CONSULTATION",
        title: "Spoofed Consultation",
        occurredAt: new Date().toISOString(),
        source: "DOCTOR",
        provenanceStatus: "PROVIDER_CREATED"
      });

    expect(res.status).toBe(400);
    // Backend rejects with 400 due to Zod strict() rejecting unknown fields like source/provenanceStatus
  });

  it("6. Patient can view own provider-created record", async () => {
    const res = await request(app)
      .get(`/api/patient/records`)
      .set("Authorization", `Bearer ${patientA.accessToken}`);

    expect(res.status).toBe(200);
    // Should contain the consultation and prescription created by Provider A
    const items = res.body.items || res.body;
    expect(items.some((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.category === "CONSULTATION" && r.provenanceStatus === "PROVIDER_CREATED")).toBe(true);
  });

  it("7. Patient B cannot view Patient A records", async () => {
    const res = await request(app)
      .get(`/api/patient/records`)
      .set("Authorization", `Bearer ${patientB.accessToken}`);

    expect(res.status).toBe(200);
    const items = res.body.items || res.body;
    expect(items.length).toBe(0);
  });
});
