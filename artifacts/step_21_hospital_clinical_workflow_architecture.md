# Step 21: Hospital Clinical Workflow Architecture

## 1. Executive Summary
This document establishes the architecture for the end-to-end Hospital Clinical Workflow in HealthVault. It unifies isolated modules (Patient, Hospital, Department, Provider, Consultation, Prescription, and Lab) into a cohesive, realistic clinical journey governed by the `Encounter`. The architecture carefully balances operational efficiency with strict zero-trust principles, ensuring that hospital staff and providers can document care without violating patient consent or tenant isolation boundaries.

## 2. Current Architecture
HealthVault currently possesses robust but detached entities:
- **Tenants:** Hospitals, Departments, Labs.
- **Identities:** Patients, Providers (with HospitalMemberships).
- **Clinical Records:** MedicalRecords (category, source, provenance), Consultations, Prescriptions, LabReports.
- **Security:** PatientLabAssociation (strict QR pairing), Consent, SharingSession, Memory-only Access Tokens, AuditLog, and AccessLog.
- **Encounter:** Exists fundamentally but lacks a strict state machine or unified UX tying everything together.

## 3. Goals
- Elevate `Encounter` to the central operational unit for a hospital visit.
- Design a secure, anti-enumeration patient registration workflow for hospitals.
- Establish a clear `Encounter` lifecycle (SCHEDULED → CHECKED_IN → IN_PROGRESS → COMPLETED).
- Integrate Consultations, Prescriptions, and Lab Requests seamlessly within the Encounter context.
- Maintain existing zero-trust privacy (Encounter ≠ universal record access).

## 4. Non-Goals
- Building a full Hospital Information System (HIS) or Electronic Medical Record (EMR) system.
- Implementing AI diagnoses or clinical decision support.
- Building DICOM/PACS imaging viewers.
- Bypassing the core Patient Consent or Lab Association mechanisms.

## 5. Recommended Workflow
**Option A (Recommended): Encounter-Centric Workflow**
An Encounter represents a specific, time-bounded interaction between a Patient and a Hospital/Provider. All newly authored clinical records (Consultations, Prescriptions) directly reference this `Encounter`.
*Why:* Highly flexible for both outpatient (clinic visits) and inpatient models, matches FHIR's `Encounter` resource, and clearly scopes the boundary of care.

*(Rejected) Option B: Admission-Centric Workflow*
A macro "Admission" entity that holds multiple micro-encounters.
*Why Rejected:* Unnecessary complexity for the prototype. The `EncounterType` (INPATIENT vs OUTPATIENT) is sufficient.

## 6. Patient Registration
**Approach: Patient-Initiated Temporary Registration QR**
- To prevent hospitals from enumerating all HealthVault users via phone/email searches, the patient generates a short-lived "Registration QR" via the Patient App.
- Hospital Staff scans this QR, which securely securely provisions the patient's demographic profile to the hospital for the duration of the Encounter creation. 
- *Privacy:* No access to historical records is granted during registration.

## 7. Encounter Lifecycle
The `EncounterStatus` enum will be expanded/enforced:
1. **SCHEDULED**: Future appointment.
2. **CHECKED_IN**: Patient physically arrived (triggers registration).
3. **IN_PROGRESS**: Provider is actively documenting care.
4. **COMPLETED**: Visit is finalized. Clinical records become immutable.
5. **CANCELLED**: Terminated before completion. No new clinical records can be attached.

## 8. Provider Assignment
- **Mechanism**: Hospital Staff assigns a Provider to the Encounter.
- **Constraints**: 
  - Provider must have an `ACTIVE` `HospitalMembership` at the *same* `hospitalId`.
  - Provider must have the `DOCTOR` role.
- **Security**: The backend explicitly validates `hospitalId` match to prevent Cross-Tenant Assignment.

## 9. Department Workflow
- The `Encounter` requires a `departmentId`.
- **UI Queue**: Providers view an "In Progress" or "Waiting" queue filtered by their assigned `Department(s)` within the Hospital tenant.

## 10. Consultation Integration
- Created by the assigned Provider during an `IN_PROGRESS` Encounter.
- Inherits `encounterId`.
- **Immutability**: Once the Encounter is `COMPLETED`, the Consultation is finalized and cannot be modified.

## 11. Prescription Integration
- Created during the Encounter.
- Inherits `encounterId`.
- Only `DOCTOR` roles can author prescriptions. 
- The prescription automatically maps to the patient's timeline as a discrete `MedicalRecord` of category `PRESCRIPTION` and provenance `PROVIDER_CREATED`.

## 12. Laboratory Integration
- **Flow**: Provider recommends a lab test (recorded in Consultation notes or a new `ServiceRequest` entity).
- **Security Constraint**: The Hospital Encounter **DOES NOT** automatically authorize the external Laboratory. 
- The Patient must still independently authorize the Lab via the `PatientLabAssociation` QR flow (Step 20B) when they visit the Lab. 
- Once the Lab pushes the `LabReport`, the Patient (or an authorized provider) can view it on the timeline.

## 13. Imaging Decision
**Deferred to Future Step.**
*Reasoning*: True radiology workflows require DICOM integration, heavy object storage (PACS), and specialized viewers. For this prototype, basic imaging summaries can simply be uploaded as `MedicalDocument` PDFs attached to an Encounter.

## 14. Discharge Workflow
- Triggered to transition an `IN_PROGRESS` inpatient/emergency Encounter to `COMPLETED`.
- Creates a `MedicalRecord` of category `DISCHARGE_SUMMARY`.
- Summarizes diagnoses, prescriptions, and follow-up instructions.

## 15. Provenance
All clinical artifacts created during this workflow automatically receive server-enforced provenance:
- Consultations / Prescriptions -> `PROVIDER_CREATED`
- Discharge Summaries -> `HOSPITAL_VERIFIED`
*The frontend cannot spoof these values; the backend derives them from the authenticated user's active membership.*

## 16. Consent Boundary
- Creating an `Encounter` does **not** grant the assigned Provider access to the patient's past medical history.
- If the Provider needs historical data (e.g., past Lab Reports from external tenants), they must request a `SharingSession` (Consent) from the patient, preserving the explicit zero-trust privacy model.

## 17. Lab Authorization Boundary
- Encounters and Labs remain completely decoupled for tenant isolation. The Hospital handles clinical ordering; the Patient authorizes the Lab independently; the Lab fulfills the order.

## 18. Role Matrix
| Action | HOSPITAL_ADMIN | HOSPITAL_STAFF | DOCTOR | PATIENT |
| :--- | :---: | :---: | :---: | :---: |
| Register Patient | DENY | ALLOW | DENY | DENY |
| Create Encounter | DENY | ALLOW | DENY | DENY |
| Assign Provider | ALLOW | ALLOW | DENY | DENY |
| Write Consultation | DENY | DENY | ALLOW | DENY |
| Write Prescription | DENY | DENY | ALLOW | DENY |
| View Own Encounters | DENY | DENY | DENY | ALLOW |

## 19. Tenant Isolation
- **Hospital A vs Hospital B**: Staff at Hospital A cannot query, view, or assign Providers to Encounters at Hospital B.
- Validated via strict `where: { hospitalId: user.hospitalMembership.hospitalId }` Prisma clauses.

## 20. Threat Model
- **ID Substitution**: Attackers swapping `encounterId` in API requests. *Mitigated by verifying the Encounter belongs to the authenticated user's Hospital tenant.*
- **Role Escalation**: Staff attempting to write Prescriptions. *Mitigated by strict `MembershipRole.DOCTOR` checks in the backend.*
- **Patient Enumeration**: *Mitigated by the Patient-Initiated Registration QR.*

## 21. Race-Condition Analysis
- **Concurrent Check-ins**: Safe. Status transitions will use optimistic locking or explicit `where: { status: 'SCHEDULED' }`.
- **Post-Completion Writes**: If a provider submits a prescription exactly as staff clicks "Complete", the backend transaction will fail the prescription write if `Encounter.status === COMPLETED`.

## 22. Audit Logging
Audit logs will track administrative actions:
- `ENCOUNTER_CREATED`
- `ENCOUNTER_CHECKED_IN`
- `ENCOUNTER_PROVIDER_ASSIGNED`
- `ENCOUNTER_COMPLETED`

## 23. Access Logging
Clinical data access (Providers viewing the newly created Consultation or Patient viewing the Timeline) will continue to generate `RECORD_VIEWED` inside the `AccessLog`.

## 24. Database Design
Existing models are 95% sufficient.
**Proposed Adjustments:**
- Add `CHECKED_IN` and `IN_PROGRESS` to `EncounterStatus` enum.
- Add `RegistrationPairingToken` model (similar to `LabPairingToken`) for secure Hospital registration without global search.
- Add `DischargeSummary` relation to `Encounter`.

## 25. API Design
**Hospital/Staff APIs**
- `POST /api/hospitals/:hospitalId/registration/consume` (Resolves patient QR)
- `POST /api/hospitals/:hospitalId/encounters`
- `PATCH /api/hospitals/:hospitalId/encounters/:id/status`
- `PATCH /api/hospitals/:hospitalId/encounters/:id/assign-provider`

**Provider APIs**
- `GET /api/provider/encounters` (Filtered by assigned provider)
- `POST /api/provider/encounters/:id/consultations`
- `POST /api/provider/encounters/:id/prescriptions`
- `POST /api/provider/encounters/:id/discharge`

**Patient APIs**
- `POST /api/patient/registration-token`
- `GET /api/patient/encounters`
- `GET /api/patient/encounters/:id`

## 26. Frontend Architecture
- `/hospital/encounters`: Dashboard for Staff to manage queues and assignments.
- `/provider/encounters`: Specialized clinical workspace for Doctors to author notes/prescriptions.
- `/encounters`: Patient-facing chronological timeline of hospital visits.

## 27. Responsive UX
- Ensure Provider authoring views (Consultation text areas, Prescription tables) are usable on tablets (768px/1024px) for clinical rounding.
- Patient timelines optimized for mobile (375px/390px).

## 28. Accessibility
- Semantic `<form>` submissions for clinical data.
- Aria-live regions for Encounter status transitions.

## 29. ABDM/FHIR Future Compatibility
- The `Encounter` model maps cleanly to the `FHIR Encounter` resource.
- Consultations map to `ClinicalImpression` or `DocumentReference`.
- No FHIR JSON structures will be embedded directly in SQL, allowing a future adapter layer to format the relational data on demand.

## 30. Migration Plan
- Forward-only migration to update `EncounterStatus` enum.
- Add `RegistrationPairingToken`.
- No destructive changes to historical Encounters (they default to `SCHEDULED` or `COMPLETED`).

## 31. Security Assumptions
- The frontend will not be trusted to send `hospitalId` or `provenanceStatus` for clinical records; it will be derived from the user's JWT + DB Memberships.

## 32. Known Limitations
- Billing and Insurance are completely excluded from this workflow.
- Inpatient bed management is simplified to just `Department` assignment.

## 33. Step 21B Implementation Plan
1. Apply Prisma schema updates (`EncounterStatus`, `RegistrationPairingToken`).
2. Build Hospital Registration QR flow.
3. Build Hospital Staff Encounter APIs.
4. Build Provider Clinical APIs (Consultation/Prescription tied to Encounter).
5. Enforce Immutability on `COMPLETED`.
6. Implement comprehensive Integration Tests.
7. Build Frontend UI for Staff, Providers, and Patients.
