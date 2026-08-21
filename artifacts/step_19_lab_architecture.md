# Step 19: Laboratory Architecture Document

## 1. Existing Architecture
The existing `schema.prisma` already contains significant foundational blocks for a Laboratory system:
- **Tenant Model**: `Lab` model exists with `id`, `publicId`, `name`, `status`, etc.
- **Membership**: `LabMembership` model exists linking `User` and `Lab` with `MembershipRole` (`LAB_USER`, `LAB_ADMIN`).
- **Provenance**: `RecordSource` includes `LAB`, and `ProvenanceStatus` includes `LAB_VERIFIED`.
- **Medical Record**: `LabReport` exists as a 1:1 nested entity to the root `MedicalRecord`.

## 2. Existing LabReport Structure
Currently, `LabReport` contains `id`, `medicalRecordId`, `labId`, `collectedAt`, `reportedAt`, and `reportMetadata Json?`. 
It natively supports linking a lab-verified document via the parent `MedicalRecord.documents`.

## 3. Lab Tenant Requirement
The `Lab` tenant model is already present in the schema. We do NOT need to create a new model, but we DO need to utilize it properly in the API and UI to support distinct Lab operations, isolating them from Hospital tenants.

## 4. Lab Membership Design
We will reuse `LabMembership`. A user must have an `ACTIVE` `LabMembership` to operate within a specific `Lab`.

## 5. Lab Roles
We will reuse the existing `MembershipRole` enum values: `LAB_ADMIN` (can manage lab details and personnel) and `LAB_USER` / `LAB_TECHNICIAN` (can manage/create Lab Reports). 

## 6. Provenance Model
- When a Patient uploads a report: `source = PATIENT`, `provenanceStatus = PATIENT_UPLOADED`.
- When an authorized Lab User creates a report: `source = LAB`, `provenanceStatus = LAB_VERIFIED`.
The backend `ClinicalRecordController` or a new `LabReportController` will STRICTLY enforce this server-side based on the authenticated context. The frontend must not send provenance.

## 7. Patient Association
Currently, any `MedicalRecord` requires a `patientId`. To prevent Lab users from querying the entire HealthVault patient database, we will enforce that the Lab User can only associate a report to a patient if they have the exact `patientId` (e.g. verified through a QR scan, or known public ID from an external system). We will not build a global patient search.

## 8. Encounter Association
A `LabReport` (via its root `MedicalRecord`) can optionally link to an `Encounter`. If an `encounterId` is provided, the backend will verify that the encounter exists and matches the `patientId`. 

## 9. Lab Result Structure (Database Changes Required)
While `LabReport.reportMetadata (Json)` exists, the requirements heavily dictate structured analysis, specific value types (`NUMERIC`, `TEXT`, `QUALITATIVE`), and discrete statuses (`NORMAL`, `HIGH`, `LOW`, etc.).
Storing these in JSON bypasses strict relational integrity and typed querying. 
We will introduce a `LabResult` model (with foreign key to `LabReport`) and necessary Enums, utilizing a forward-only migration.
Fields: `id`, `labReportId`, `testName`, `testCode`, `value`, `valueType`, `unit`, `referenceRange`, `status`, `createdAt`, `updatedAt`.

## 10. Authorization Model
- **Lab User**: Active `LabMembership` + `LAB_USER` or `LAB_ADMIN`.
- **Action**: Create/Update `LabReport` bounded to their `labId`.
- **Patient**: View their own `LAB_VERIFIED` reports. Cannot modify them.
- **Provider**: View `LAB_VERIFIED` reports if authorized (e.g., via `Encounter` or `SharingSession`).

## 11. Document Architecture
Documents uploaded for a Lab Report will be linked to the root `MedicalRecord`. Storage utilizes the existing `MedicalDocument` model and `StorageProvider`. Document access inherits the `MedicalRecord` authorization exactly as before.

## 12. Audit and Access Logging
- `AuditLog`: New actions or existing ones (like `RECORD_UPLOADED`) will be utilized to track the creation of Lab Reports.
- `AccessLog`: `VIEW` events will be generated when Patients/Providers/Lab Users view the reports.

## 13. Required Database Changes
We will create a single forward-only migration adding:
- Enum `LabResultValueType` (`NUMERIC`, `TEXT`, `QUALITATIVE`)
- Enum `LabResultStatus` (`NORMAL`, `HIGH`, `LOW`, `CRITICAL`, `ABNORMAL`, `UNSPECIFIED`)
- Model `LabResult` (linking to `LabReport`)
- *(Optional)* Add a status field to `LabReport` if we need `DRAFT` vs `FINALIZED`. Checking `schema.prisma`, `MedicalRecord` already has `RecordLifecycleStatus` (`ACTIVE`, `ARCHIVED`, `SUPERSEDED`, `REVOKED`), which might suffice, but `DRAFT`/`FINALIZED` is specifically requested. We will add a `status` field to `LabReport` (Enum `LabReportStatus`: `DRAFT`, `FINALIZED`, `AMENDED`, `CANCELLED`).

## 14. Why Database Changes Are Necessary
The existing schema was very forward-looking by including `Lab` and `LabReport`, but lacks the granularity required for the `LabResult` structured data and `LabReportStatus` lifecycle strictly outlined in Step 19. A small, clean migration is required.
