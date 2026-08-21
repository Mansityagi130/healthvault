# Clinical Record Architecture Decision (Step 18)

## 1. Context
The goal of Step 18 is to allow authorized providers to create clinical records (Consultations and Prescriptions) within an active Encounter. We must determine the optimal database architecture that balances normalization, security, and a unified timeline for the patient.

## 2. Decision: Shared Root Entity Pattern
We will use the existing `MedicalRecord` model as the **common root entity** for all clinical records, and delegate specialized, structured data to child tables like `Consultation` and `Prescription`.

### Why this approach?
- **Unified Timeline**: The patient UI (`/records`) already queries the `MedicalRecord` table. By making every provider-generated consultation or prescription a `MedicalRecord` first, it automatically appears in the patient's timeline without requiring complex SQL joins or union queries across multiple tables.
- **Centralized Security**: Attributes like `provenanceStatus`, `source`, `lifecycleStatus`, `patientId`, and `encounterId` reside in the root `MedicalRecord`. This guarantees that access logging, audit logging, and authorization rules are applied consistently across all record types.
- **Extensibility**: When new record types are introduced (e.g., lab reports, imaging), we only need to add a new optional relationship to `MedicalRecord` and a specialized table, rather than duplicating timeline logic.

## 3. Data Model Breakdown

### MedicalRecord (The Root)
- **Identity**: `id`, `patientId`, `encounterId`, `hospitalId`
- **Metadata**: `category` (e.g., `CONSULTATION`, `PRESCRIPTION`), `title`, `occurredAt`
- **Provenance**: `source` (must be `DOCTOR` or `HOSPITAL`), `provenanceStatus` (must be `PROVIDER_CREATED`)
- **Lifecycle**: `lifecycleStatus` (e.g., `ACTIVE`, `AMENDED`)

### Consultation (The Specialized Data)
- **Relation**: `medicalRecordId` (1-to-1)
- **Clinical Data**: `clinicalSummary` (JSON or structured text for chief complaint, assessment, plan)

### Prescription & PrescriptionItem (The Specialized Data)
- **Relation**: `medicalRecordId` (1-to-1)
- **Clinical Data**: `items` (1-to-Many relation storing medication name, dosage, frequency, duration, instructions)

## 4. Provenance & Security Enforcement
- **Backend Driven**: The frontend will never submit `source` or `provenanceStatus`. The backend controller will hardcode these values to `RecordSource.DOCTOR` and `ProvenanceStatus.PROVIDER_CREATED` upon creation.
- **Encounter Binding**: The backend will strictly verify that the `encounterId` is valid, `ACTIVE`, and that the authenticated provider is authorized for that encounter before inserting the `MedicalRecord`.

This architecture is currently reflected in the Prisma schema and requires no new database migrations. We will proceed with implementing the controllers, services, and frontend UI to utilize this existing schema safely.
