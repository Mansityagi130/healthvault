import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { 
  RecordCategory
} from "../src/generated/prisma/enums.js";
import { generate } from "otplib";
import { pollOutbox } from "../src/jobs/outbox-poller.js";
import { processAllMockJobs } from "../src/jobs/queue.js";

const prisma = databaseClient.getClient();

describe("End-to-End Release Demo Verification Flow", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);
    await databaseClient.disconnect();
  });

  it("Executes the full 20-step pre-deployment flow successfully", async () => {
    console.log("=== STARTING 20-STEP END-TO-END DEMO ===");

    // 1. Register patient
    const email = `patient.demo.${Date.now()}@example.com`;
    const regRes = await request(app).post("/api/auth/register").send({
      email,
      password: "Password123!",
      firstName: "Demo",
      lastName: "Patient"
    });
    expect(regRes.status).toBe(201);
    const userId = regRes.body.user.id;
    console.log("Step 1: Patient registered successfully. User ID:", userId);

    // 2. Login
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "Password123!"
    });
    expect(loginRes.status).toBe(200);
    const patientToken = loginRes.body.accessToken;
    const prof = await prisma.patientProfile.findFirst({ where: { userId } });
    expect(prof).toBeDefined();
    const patientProfileId = prof!.id;
    console.log("Step 2: Login successful. Access Token received. Profile ID:", patientProfileId);

    // 3. Enable MFA (Enroll)
    const enrollMfa = await request(app)
      .post("/api/auth/mfa/enroll")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(enrollMfa.status).toBe(200);
    const mfaSecret = enrollMfa.body.secret;
    console.log("Step 3: MFA Enrollment initiated. Secret generated.");

    // 4. Verify MFA
    const code = await generate({ secret: mfaSecret });
    const confirmMfa = await request(app)
      .post("/api/auth/mfa/confirm")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ code });
    expect(confirmMfa.status).toBe(200);
    console.log("Step 4: MFA verified and confirmed successfully.");

    // 5. Create hospital relationship
    // Create hospital, doctor, staff, and pairing token
    const hospital = await prisma.hospital.create({ data: { name: "Demo General Hospital" } });
    const doctorUser = await request(app).post("/api/auth/register").send({
      email: `doctor.demo.${Date.now()}@example.com`,
      password: "Password123!",
      firstName: "John",
      lastName: "Doe"
    });
    const doctorLogin = await request(app).post("/api/auth/login").send({
      email: doctorUser.body.user.email,
      password: "Password123!"
    });
    const doctorToken = doctorLogin.body.accessToken;
    
    await prisma.doctorProfile.create({
      data: {
        userId: doctorUser.body.user.id,
        registrationNumber: `REG-DEMO-${Date.now()}`,
        specialty: "Internal Medicine"
      }
    });
    await prisma.hospitalMembership.create({
      data: { userId: doctorUser.body.user.id, hospitalId: hospital.id, role: "DOCTOR", status: "ACTIVE" }
    });

    const staffUser = await request(app).post("/api/auth/register").send({
      email: `staff.demo.${Date.now()}@example.com`,
      password: "Password123!",
      firstName: "Jane",
      lastName: "Smith"
    });
    const staffLogin = await request(app).post("/api/auth/login").send({
      email: staffUser.body.user.email,
      password: "Password123!"
    });
    const staffToken = staffLogin.body.accessToken;
    await prisma.hospitalMembership.create({
      data: { userId: staffUser.body.user.id, hospitalId: hospital.id, role: "STAFF", status: "ACTIVE" }
    });

    // Create patient pairing token
    const tokenRes = await request(app)
      .post("/api/patient/registration-token")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ expiresInMinutes: 15 });
    console.log("Token Response status:", tokenRes.status, "body:", tokenRes.body);
    expect(tokenRes.status).toBe(201);
    
    // Consume pairing token
    const consumeRes = await request(app)
      .post(`/api/hospitals/${hospital.id}/registration/consume`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ selector: tokenRes.body.selector, token: tokenRes.body.token });
    expect(consumeRes.status).toBe(200);
    console.log("Step 5: Hospital relationship established.");

    // 6. Create encounter
    const encRes = await request(app)
      .post(`/api/hospitals/${hospital.id}/encounters`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        patientId: patientProfileId,
        type: "OUTPATIENT",
        reason: "E2E Assessment",
        providerId: doctorUser.body.user.id
      });
    expect(encRes.status).toBe(201);
    const encounterId = encRes.body.id;
    console.log("Step 6: Encounter registered. ID:", encounterId);

    // 7. Provider accesses authorized context
    // Change status to IN_PROGRESS
    await request(app)
      .patch(`/api/hospitals/${hospital.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "CHECKED_IN" });

    await request(app)
      .patch(`/api/hospitals/${hospital.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "IN_PROGRESS" });
    console.log("Step 7: Encounter transitioned to IN_PROGRESS.");

    // 8. Provider creates consultation
    const consultRes = await request(app)
      .post(`/api/provider/encounters/${encounterId}/consultations`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        chiefComplaint: "Fatigue",
        clinicalNotes: "Patient presents with persistent exhaustion.",
        assessment: "Mild iron deficiency anemia suggested.",
        plan: "CBC test and iron supplements."
      });
    expect(consultRes.status).toBe(201);
    console.log("Step 8: Consultation recorded successfully.");

    // 9. Provider creates prescription
    const prescRes = await request(app)
      .post(`/api/provider/encounters/${encounterId}/prescriptions`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        instructions: "Take once daily after food",
        items: [{ medicationName: "Iron Supplement 100mg", dosage: "1 tab", frequency: "Daily", duration: "30 days" }]
      });
    expect(prescRes.status).toBe(201);
    console.log("Step 9: Prescription created successfully.");

    // 10. Lab pairing
    const lab = await prisma.lab.create({ data: { name: "Demo Lab Services" } });
    const labStaff = await request(app).post("/api/auth/register").send({
      email: `lab.demo.${Date.now()}@example.com`,
      password: "Password123!",
      firstName: "Lab",
      lastName: "Technician"
    });
    const labLogin = await request(app).post("/api/auth/login").send({
      email: labStaff.body.user.email,
      password: "Password123!"
    });
    console.log("Lab Register Status:", labStaff.status, "body:", labStaff.body);
    console.log("Lab Login Status:", labLogin.status, "body:", labLogin.body);
    const labToken = labLogin.body.accessToken;
    await prisma.labMembership.create({
      data: { userId: labStaff.body.user.id, labId: lab.id, role: "LAB_USER", status: "ACTIVE" }
    });

    // Create association token
    const associationTokenRes = await request(app)
      .post("/api/patient/lab-associations/pairing-token")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ expiresInMinutes: 15 });
    expect(associationTokenRes.status).toBe(201);

    // Consume association token
    const assocConsume = await request(app)
      .post(`/api/labs/${lab.id}/associations/consume`)
      .set("Authorization", `Bearer ${labToken}`)
      .send({ selector: associationTokenRes.body.selector, token: associationTokenRes.body.token });
    expect(assocConsume.status).toBe(200);
    const associationId = assocConsume.body.associationId;
    
    // Patient approves lab association
    const approveAssoc = await request(app)
      .post("/api/patient/lab-associations/approve")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ associationId });
    expect(approveAssoc.status).toBe(200);
    console.log("Step 10: Lab pairing / association established and approved successfully.");

    // 11. Lab creates report
    const draftRes = await request(app)
      .post(`/api/labs/${lab.id}/reports`)
      .set("Authorization", `Bearer ${labToken}`)
      .send({
        patientId: patientProfileId,
        title: "Complete Blood Count"
      });
    expect(draftRes.status).toBe(201);
    const reportId = draftRes.body.id;
    console.log("Step 11: Lab report draft created. Report ID:", reportId);

    // 12. Finalize report
    const finalRes = await request(app)
      .patch(`/api/labs/${lab.id}/reports/${reportId}/finalize`)
      .set("Authorization", `Bearer ${labToken}`)
      .send({
        results: [{ testName: "Hemoglobin", value: "11.5", unit: "g/dL", status: "NORMAL", referenceRange: "12-16" }]
      });
    expect(finalRes.status).toBe(200);
    console.log("Step 12: Lab report finalized with results.");

    // 13. Upload medical document
    // Create record to attach
    const uploadRec = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        category: RecordCategory.IMAGING,
        title: "X-Ray Report",
        occurredAt: new Date().toISOString()
      });
    expect(uploadRec.status).toBe(201);
    const recordId = uploadRec.body.id;

    const pdfBuffer = Buffer.from("%PDF-1.4\n%...\nEOF");
    const docUpload = await request(app)
      .post(`/api/patient/records/${recordId}/documents`)
      .set("Authorization", `Bearer ${patientToken}`)
      .attach("file", pdfBuffer, { filename: "xray.pdf", contentType: "application/pdf" });
    expect(docUpload.status).toBe(201);
    const docId = docUpload.body.id;
    console.log("Step 13: Document uploaded to patient record. ID:", docId);

    // 14. Document enters quarantine
    const verifyQuar = await request(app)
      .get(`/api/patient/documents/${docId}`)
      .set("Authorization", `Bearer ${patientToken}`);
    // Status is PENDING_SCAN, should return 403 Forbidden!
    expect(verifyQuar.status).toBe(403);
    console.log("Step 14: Confirmed uploaded document is in quarantine (inaccessible).");

    // 15. Background worker scans it
    await pollOutbox();
    await processAllMockJobs();
    console.log("Step 15: Background scanner job processed successfully.");

    // 16. CLEAN document becomes available
    const verifyClean = await prisma.medicalDocument.findUnique({ where: { id: docId } });
    expect(verifyClean?.securityStatus).toBe("CLEAN");
    console.log("Step 16: Document status promoted to CLEAN.");

    // 17. Notification is generated
    const notifs = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(notifs.status).toBe(200);
    // Find security or document update notification
    expect(notifs.body.items.length).toBeGreaterThan(0);
    console.log("Step 17: Notification successfully created and fetched for patient.");

    // 18. Patient sees timeline
    const timeline = await request(app)
      .get("/api/patient/records")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(timeline.status).toBe(200);
    expect(timeline.body.items.length).toBeGreaterThan(0);
    console.log("Step 18: Patient retrieved their health timeline records successfully.");

    // 19. Authorized FHIR export
    const fhirRes = await request(app)
      .get(`/api/interoperability/fhir/Patient/${patientProfileId}/$export`)
      .set("Authorization", `Bearer ${patientToken}`);
    expect(fhirRes.status).toBe(200);
    expect(fhirRes.body.resourceType).toBe("Bundle");
    console.log("Step 19: Patient exported health records in FHIR R4 Bundle format.");

    // 20. Unauthorized user attempts access and is blocked
    const intruder = await request(app).post("/api/auth/register").send({
      email: `intruder.demo.${Date.now()}@example.com`,
      password: "Password123!",
      firstName: "Malicious",
      lastName: "Intruder"
    });
    const intruderLogin = await request(app).post("/api/auth/login").send({
      email: intruder.body.user.email,
      password: "Password123!"
    });
    const intruderToken = intruderLogin.body.accessToken;

    const hackAttempt = await request(app)
      .get(`/api/patient/records/${recordId}`)
      .set("Authorization", `Bearer ${intruderToken}`); // Should be blocked
    expect(hackAttempt.status).toBe(404); // Forbidden/not found to prevent enumeration
    console.log("Step 20: Intruder blocked from accessing patient record.");

    console.log("=== 20-STEP END-TO-END DEMO COMPLETED SUCCESSFULLY ===");
  });
});
