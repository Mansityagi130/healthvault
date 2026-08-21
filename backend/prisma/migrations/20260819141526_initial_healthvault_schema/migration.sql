-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "ProfileVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('DOCTOR', 'HOSPITAL_ADMIN', 'STAFF', 'LAB_USER', 'LAB_ADMIN');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RecordCategory" AS ENUM ('CONSULTATION', 'PRESCRIPTION', 'LAB_REPORT', 'IMAGING', 'DISCHARGE_SUMMARY', 'VACCINATION', 'OTHER');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('PATIENT', 'DOCTOR', 'HOSPITAL', 'LAB');

-- CreateEnum
CREATE TYPE "ProvenanceStatus" AS ENUM ('PATIENT_UPLOADED', 'PROVIDER_CREATED', 'HOSPITAL_CREATED', 'LAB_VERIFIED');

-- CreateEnum
CREATE TYPE "RecordLifecycleStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'SUPERSEDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConsentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SharingSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QRUsageMode" AS ENUM ('ONE_TIME', 'CONTROLLED_REUSE');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('VIEW', 'DOWNLOAD', 'CREATE', 'UPDATE', 'EMERGENCY_VIEW');

-- CreateEnum
CREATE TYPE "AccessOutcome" AS ENUM ('ALLOWED', 'DENIED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CONSENT_REQUESTED', 'CONSENT_APPROVED', 'CONSENT_REJECTED', 'CONSENT_REVOKED', 'SHARING_SESSION_CREATED', 'SHARING_SESSION_REVOKED', 'QR_SESSION_CREATED', 'QR_SESSION_REVOKED', 'RECORD_UPLOADED', 'RECORD_VIEWED', 'RECORD_DOWNLOADED', 'MEMBERSHIP_CREATED', 'MEMBERSHIP_REVOKED', 'EMERGENCY_PROFILE_ACCESSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONSENT_REQUEST', 'CONSENT_DECISION', 'SHARING_SESSION', 'SECURITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "ExternalReferenceStatus" AS ENUM ('PENDING', 'VERIFIED', 'SYNCED', 'FAILED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "publicId" UUID NOT NULL,
    "authSubject" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" UUID NOT NULL,
    "publicId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "sexAtBirth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" UUID NOT NULL,
    "publicId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "specialty" TEXT,
    "verificationStatus" "ProfileVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" UUID NOT NULL,
    "publicId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "verificationStatus" "ProfileVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalMembership" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" UUID NOT NULL,
    "publicId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "verificationStatus" "ProfileVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabMembership" (
    "id" UUID NOT NULL,
    "labId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" UUID NOT NULL,
    "publicId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "category" "RecordCategory" NOT NULL,
    "source" "RecordSource" NOT NULL,
    "provenanceStatus" "ProvenanceStatus" NOT NULL,
    "lifecycleStatus" "RecordLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "hospitalId" UUID,
    "labId" UUID,
    "supersedesRecordId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalDocument" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "uploadedByUserId" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "doctorProfileId" UUID,
    "hospitalId" UUID,
    "encounterAt" TIMESTAMP(3) NOT NULL,
    "clinicalSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "doctorProfileId" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "quantity" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabReport" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "labId" UUID NOT NULL,
    "createdByUserId" UUID,
    "collectedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "reportMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingRecord" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "modality" TEXT,
    "imagingProvider" TEXT,
    "studyAt" TIMESTAMP(3),
    "reportMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DischargeSummary" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "hospitalId" UUID,
    "admittedAt" TIMESTAMP(3),
    "dischargedAt" TIMESTAMP(3),
    "summaryMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccinationRecord" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "providerName" TEXT,
    "batchNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRequest" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "requesterUserId" UUID NOT NULL,
    "requesterHospitalId" UUID,
    "purpose" TEXT NOT NULL,
    "status" "ConsentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRequestScope" (
    "id" UUID NOT NULL,
    "consentRequestId" UUID NOT NULL,
    "recordCategory" "RecordCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRequestScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "granteeUserId" UUID NOT NULL,
    "consentRequestId" UUID,
    "purpose" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentScope" (
    "id" UUID NOT NULL,
    "consentId" UUID NOT NULL,
    "recordCategory" "RecordCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingSession" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "granteeUserId" UUID NOT NULL,
    "consentId" UUID NOT NULL,
    "purposeSnapshot" TEXT NOT NULL,
    "status" "SharingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharingSessionScope" (
    "id" UUID NOT NULL,
    "sharingSessionId" UUID NOT NULL,
    "recordCategory" "RecordCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharingSessionScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRSession" (
    "id" UUID NOT NULL,
    "sharingSessionId" UUID NOT NULL,
    "selector" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usageMode" "QRUsageMode" NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyProfile" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "bloodGroup" TEXT,
    "allergies" JSONB,
    "emergencyMedications" JSONB,
    "criticalConditions" JSONB,
    "emergencyContact" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyProfileAccessToken" (
    "id" UUID NOT NULL,
    "emergencyProfileId" UUID NOT NULL,
    "selector" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usageMode" "QRUsageMode" NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyProfileAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "patientId" UUID NOT NULL,
    "medicalRecordId" UUID,
    "consentId" UUID,
    "sharingSessionId" UUID,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" "AccessAction" NOT NULL,
    "outcome" "AccessOutcome" NOT NULL,
    "purpose" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "identifierEncrypted" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "status" "ExternalReferenceStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRecordReference" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "externalReferenceEncrypted" TEXT NOT NULL,
    "externalReferenceHash" TEXT NOT NULL,
    "status" "ExternalReferenceStatus" NOT NULL DEFAULT 'PENDING',
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalRecordReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "User_authSubject_key" ON "User"("authSubject");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_publicId_key" ON "PatientProfile"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_publicId_key" ON "DoctorProfile"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_registrationNumber_key" ON "DoctorProfile"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_publicId_key" ON "Hospital"("publicId");

-- CreateIndex
CREATE INDEX "HospitalMembership_hospitalId_status_idx" ON "HospitalMembership"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "HospitalMembership_userId_status_idx" ON "HospitalMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalMembership_hospitalId_userId_key" ON "HospitalMembership"("hospitalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_publicId_key" ON "Lab"("publicId");

-- CreateIndex
CREATE INDEX "LabMembership_labId_status_idx" ON "LabMembership"("labId", "status");

-- CreateIndex
CREATE INDEX "LabMembership_userId_status_idx" ON "LabMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LabMembership_labId_userId_key" ON "LabMembership"("labId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecord_publicId_key" ON "MedicalRecord"("publicId");

-- CreateIndex
CREATE INDEX "MedicalRecord_patientId_issuedAt_createdAt_idx" ON "MedicalRecord"("patientId", "issuedAt" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MedicalRecord_patientId_category_issuedAt_idx" ON "MedicalRecord"("patientId", "category", "issuedAt" DESC);

-- CreateIndex
CREATE INDEX "MedicalRecord_supersedesRecordId_idx" ON "MedicalRecord"("supersedesRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalDocument_storageKey_key" ON "MedicalDocument"("storageKey");

-- CreateIndex
CREATE INDEX "MedicalDocument_medicalRecordId_uploadedAt_idx" ON "MedicalDocument"("medicalRecordId", "uploadedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_medicalRecordId_key" ON "Consultation"("medicalRecordId");

-- CreateIndex
CREATE INDEX "Consultation_doctorProfileId_encounterAt_idx" ON "Consultation"("doctorProfileId", "encounterAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_medicalRecordId_key" ON "Prescription"("medicalRecordId");

-- CreateIndex
CREATE INDEX "Prescription_doctorProfileId_issuedAt_idx" ON "Prescription"("doctorProfileId", "issuedAt" DESC);

-- CreateIndex
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_medicalRecordId_key" ON "LabReport"("medicalRecordId");

-- CreateIndex
CREATE INDEX "LabReport_labId_reportedAt_idx" ON "LabReport"("labId", "reportedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ImagingRecord_medicalRecordId_key" ON "ImagingRecord"("medicalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeSummary_medicalRecordId_key" ON "DischargeSummary"("medicalRecordId");

-- CreateIndex
CREATE INDEX "DischargeSummary_hospitalId_dischargedAt_idx" ON "DischargeSummary"("hospitalId", "dischargedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "VaccinationRecord_medicalRecordId_key" ON "VaccinationRecord"("medicalRecordId");

-- CreateIndex
CREATE INDEX "ConsentRequest_patientId_status_expiresAt_idx" ON "ConsentRequest"("patientId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ConsentRequest_requesterUserId_status_expiresAt_idx" ON "ConsentRequest"("requesterUserId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRequestScope_consentRequestId_recordCategory_key" ON "ConsentRequestScope"("consentRequestId", "recordCategory");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_consentRequestId_key" ON "Consent"("consentRequestId");

-- CreateIndex
CREATE INDEX "Consent_patientId_status_expiresAt_idx" ON "Consent"("patientId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Consent_granteeUserId_status_expiresAt_idx" ON "Consent"("granteeUserId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentScope_consentId_recordCategory_key" ON "ConsentScope"("consentId", "recordCategory");

-- CreateIndex
CREATE INDEX "SharingSession_consentId_status_expiresAt_idx" ON "SharingSession"("consentId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SharingSession_patientId_status_expiresAt_idx" ON "SharingSession"("patientId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SharingSession_granteeUserId_status_expiresAt_idx" ON "SharingSession"("granteeUserId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharingSessionScope_sharingSessionId_recordCategory_key" ON "SharingSessionScope"("sharingSessionId", "recordCategory");

-- CreateIndex
CREATE UNIQUE INDEX "QRSession_selector_key" ON "QRSession"("selector");

-- CreateIndex
CREATE UNIQUE INDEX "QRSession_tokenHash_key" ON "QRSession"("tokenHash");

-- CreateIndex
CREATE INDEX "QRSession_expiresAt_revokedAt_idx" ON "QRSession"("expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "QRSession_sharingSessionId_expiresAt_idx" ON "QRSession"("sharingSessionId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyProfile_patientId_key" ON "EmergencyProfile"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyProfileAccessToken_selector_key" ON "EmergencyProfileAccessToken"("selector");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyProfileAccessToken_tokenHash_key" ON "EmergencyProfileAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmergencyProfileAccessToken_expiresAt_revokedAt_idx" ON "EmergencyProfileAccessToken"("expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "EmergencyProfileAccessToken_emergencyProfileId_expiresAt_idx" ON "EmergencyProfileAccessToken"("emergencyProfileId", "expiresAt");

-- CreateIndex
CREATE INDEX "AccessLog_patientId_occurredAt_idx" ON "AccessLog"("patientId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AccessLog_actorUserId_occurredAt_idx" ON "AccessLog"("actorUserId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AccessLog_medicalRecordId_occurredAt_idx" ON "AccessLog"("medicalRecordId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AccessLog_correlationId_idx" ON "AccessLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_occurredAt_idx" ON "AuditLog"("targetType", "targetId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ExternalIdentity_userId_externalSystem_idx" ON "ExternalIdentity"("userId", "externalSystem");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_externalSystem_identifierHash_key" ON "ExternalIdentity"("externalSystem", "identifierHash");

-- CreateIndex
CREATE INDEX "ExternalRecordReference_medicalRecordId_externalSystem_idx" ON "ExternalRecordReference"("medicalRecordId", "externalSystem");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRecordReference_externalSystem_externalReferenceHas_key" ON "ExternalRecordReference"("externalSystem", "externalReferenceHash");

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalMembership" ADD CONSTRAINT "HospitalMembership_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalMembership" ADD CONSTRAINT "HospitalMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabMembership" ADD CONSTRAINT "LabMembership_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabMembership" ADD CONSTRAINT "LabMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_supersedesRecordId_fkey" FOREIGN KEY ("supersedesRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingRecord" ADD CONSTRAINT "ImagingRecord_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSummary" ADD CONSTRAINT "DischargeSummary_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSummary" ADD CONSTRAINT "DischargeSummary_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequest" ADD CONSTRAINT "ConsentRequest_requesterHospitalId_fkey" FOREIGN KEY ("requesterHospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRequestScope" ADD CONSTRAINT "ConsentRequestScope_consentRequestId_fkey" FOREIGN KEY ("consentRequestId") REFERENCES "ConsentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_consentRequestId_fkey" FOREIGN KEY ("consentRequestId") REFERENCES "ConsentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentScope" ADD CONSTRAINT "ConsentScope_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingSession" ADD CONSTRAINT "SharingSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingSession" ADD CONSTRAINT "SharingSession_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingSession" ADD CONSTRAINT "SharingSession_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharingSessionScope" ADD CONSTRAINT "SharingSessionScope_sharingSessionId_fkey" FOREIGN KEY ("sharingSessionId") REFERENCES "SharingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRSession" ADD CONSTRAINT "QRSession_sharingSessionId_fkey" FOREIGN KEY ("sharingSessionId") REFERENCES "SharingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyProfile" ADD CONSTRAINT "EmergencyProfile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyProfileAccessToken" ADD CONSTRAINT "EmergencyProfileAccessToken_emergencyProfileId_fkey" FOREIGN KEY ("emergencyProfileId") REFERENCES "EmergencyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_sharingSessionId_fkey" FOREIGN KEY ("sharingSessionId") REFERENCES "SharingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecordReference" ADD CONSTRAINT "ExternalRecordReference_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
