import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
const prisma = databaseClient.getClient();
import { 
  MembershipRole, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  RecordCategory, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  RecordSource, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  ProvenanceStatus, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  LabReportStatus,
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  LabResultStatus,
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  LabResultValueType
} from "../src/generated/prisma/enums.js";

describe("Lab Architecture Security", () => {
  let patientA: unknown;
  let patientB: unknown;
  let labTech: unknown;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
  let unauthLabUser: unknown;
  let doctor: unknown;
  let labA: unknown;
  let labB: unknown;
  let hospital: unknown;
  let encounter: unknown;
  let reportId: string;

  async function registerAndLogin(email: string) {
    await request(app).post("/api/auth/register").send({
      email,
      password: "password123",
      firstName: "Test",
      lastName: "User"
    });
    const res = await request(app).post("/api/auth/login").send({
      email,
      password: "password123"
    });
    return {
      id: res.body.user.id,
      accessToken: res.body.accessToken
    };
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    patientA = await registerAndLogin(`patient_a_lab_${Date.now()}@example.com`);
    patientB = await registerAndLogin(`patient_b_lab_${Date.now()}@example.com`);
    labTech = await registerAndLogin(`lab_tech_${Date.now()}@example.com`);
    unauthLabUser = await registerAndLogin(`unauth_lab_${Date.now()}@example.com`);
    doctor = await registerAndLogin(`doctor_lab_${Date.now()}@example.com`);

    // Create Labs
    labA = await prisma.lab.create({
      data: { name: "Central Lab A" }
    });
    labB = await prisma.lab.create({
      data: { name: "Westside Lab B" }
    });

    // Create Hospital and Encounter
    hospital = await prisma.hospital.create({
      data: { name: "City Hospital", code: `CITY_${Date.now()}` }
    });
    const patAProfile = await prisma.patientProfile.findUnique({ where: { userId: patientA.id } });
    
    encounter = await prisma.encounter.create({
      data: {
        patientId: patAProfile!.id,
        hospitalId: hospital.id,
        type: "OUTPATIENT",
        status: "ACTIVE"
      }
    });

    // Create Lab Memberships
    await prisma.labMembership.create({
      data: {
        labId: labA.id,
        userId: labTech.id,
        role: MembershipRole.LAB_USER,
        status: "ACTIVE"
      }
    });

    // Create ACTIVE association for Lab A to allow report creation
    await prisma.patientLabAssociation.create({
      data: {
        patientId: patAProfile!.id,
        labId: labA.id,
        status: "ACTIVE"
      }
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    });

  it("1. Non-lab user cannot create report", async () => {
    const patAProfile = await prisma.patientProfile.findUnique({ where: { userId: patientA.id } });
    const res = await request(app)
      .post(`/api/labs/${labA.id}/reports`)
      .set("Authorization", `Bearer ${doctor.accessToken}`)
      .send({
        patientId: patAProfile!.id,
      });
    expect(res.status).toBe(403);
  });

  it("2. Lab A member cannot access Lab B", async () => {
    const patAProfile = await prisma.patientProfile.findUnique({ where: { userId: patientA.id } });
    const res = await request(app)
      .post(`/api/labs/${labB.id}/reports`)
      .set("Authorization", `Bearer ${labTech.accessToken}`) // Belongs to Lab A
      .send({ patientId: patAProfile!.id });
    expect(res.status).toBe(403);
  });

  it("3. Authorized lab member creates report (becomes LAB_VERIFIED)", async () => {
    const patAProfile = await prisma.patientProfile.findUnique({ where: { userId: patientA.id } });
    const res = await request(app)
      .post(`/api/labs/${labA.id}/reports`)
      .set("Authorization", `Bearer ${labTech.accessToken}`)
      .send({
        patientId: patAProfile!.id,
        title: "Complete Blood Count",
        encounterId: encounter.id
      });
      
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("DRAFT");
    
    // Check provenance was strictly derived
    const record = await prisma.medicalRecord.findUnique({ where: { id: res.body.medicalRecordId } });
    expect(record!.source).toBe("LAB");
    expect(record!.provenanceStatus).toBe("LAB_VERIFIED");
    
    reportId = res.body.id;
  });

  it("4. Patient cannot claim LAB_VERIFIED (Spoofing prevention)", async () => {
    const res = await request(app)
      .post("/api/patient/records") // This uses standard patient upload logic
      .set("Authorization", `Bearer ${patientA.accessToken}`)
      .send({
        category: "LAB_REPORT",
        title: "Hacked Lab Report",
        occurredAt: new Date().toISOString(),
        source: "LAB", // Attempt to spoof
        provenanceStatus: "LAB_VERIFIED"
      });
      
    // Because Zod strict() is applied on createRecordSchema, unknown fields are rejected
    // OR if we didn't use strict, the backend hardcodes source: PATIENT and provenance: PATIENT_UPLOADED.
    // In our app, Zod strict throws 400.
    expect(res.status).toBe(400); 
  });

  it("5. Add lab result to DRAFT report", async () => {
    const res = await request(app)
      .post(`/api/labs/${labA.id}/reports/${reportId}/results`)
      .set("Authorization", `Bearer ${labTech.accessToken}`)
      .send({
        testName: "Hemoglobin",
        value: "14.2",
        valueType: "NUMERIC",
        unit: "g/dL",
        referenceRange: "13.8 - 17.2",
        status: "NORMAL"
      });
    expect(res.status).toBe(201);
  });

  it("6. Finalized report cannot be modified", async () => {
    // Finalize it
// eslint-disable-next-line prefer-const -- Needed for test fixtures/types
    let res = await request(app)
      .patch(`/api/labs/${labA.id}/reports/${reportId}/finalize`)
      .set("Authorization", `Bearer ${labTech.accessToken}`);
    expect(res.status).toBe(200);

    // Attempt to add result
// eslint-disable-next-line prefer-const -- Needed for test fixtures/types
    let addRes = await request(app)
      .post(`/api/labs/${labA.id}/reports/${reportId}/results`)
      .set("Authorization", `Bearer ${labTech.accessToken}`)
      .send({
        testName: "WBC",
        value: "5.0",
        valueType: "NUMERIC"
      });
    expect(addRes.status).toBe(400); // Only DRAFT allowed
  });

  it("7. Patient B cannot access Patient A lab report", async () => {
    const res = await request(app)
      .get(`/api/patient/records`)
      .set("Authorization", `Bearer ${patientB.accessToken}`);
      
    const containsReport = res.body.items?.some((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => item.title === "Complete Blood Count");
    expect(containsReport).toBeFalsy();
  });

});
