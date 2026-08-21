# Step 20: Patient ↔ Lab Association Architecture

## 1. Problem Statement
HealthVault correctly isolates LabReports to specific Labs and Patients. However, currently, a Laboratory must inherently *know* a patient's exact internal `patientId` to create a `LabReport`. Passing `labId + patientId` blindly assumes trust in the Lab not to guess or maliciously associate reports with unrelated patients. We need a robust, privacy-preserving, anti-enumeration handshake that securely pairs a Patient to a Laboratory for the explicit purpose of generating medical data.

## 2. Goals
- Establish an explicit, verifiable `PatientLabAssociation`.
- Prevent patient identity enumeration by malicious or compromised lab staff.
- Ensure cross-tenant isolation (Lab A has zero visibility into Lab B's associations).
- Maintain strict privacy (associations do NOT grant read access to historical patient records).
- Provide a secure audit trail of all pairing events.

## 3. Non-Goals
- **No Global Search**: Labs will not be able to search the HealthVault patient directory.
- **No Medical Read Access**: This association only authorizes the *creation* of lab data, not the consumption of existing patient histories, unless explicit consent is granted elsewhere.
- **No ABDM/FHIR Implementations**: We design for future compatibility, but do not implement the external protocols here.

## 4. Current Architecture
- Patients and Labs exist independently.
- `LabReport` creation currently relies on the frontend securely acquiring the `patientId`.
- The system supports temporary `SharingSession` and `QRSession` models, but these are geared towards granting *read access* to existing records, not *write authorization* to independent tenants.

## 5. Association Concept
We will introduce a dedicated `PatientLabAssociation` entity representing the explicit relationship between a HealthVault Patient and a specific Laboratory. This association governs the Lab's authority to act on behalf of the patient.

## 6. Identity Strategy
To prevent enumeration (e.g., querying `GET /patients?phone=123`), the Lab must never be allowed to "guess" a patient. Patient identity must be explicitly presented by the patient to the lab, acting as a cryptographic introduction.

## 7. Recommended Pairing Mechanism
**Option A: Lab-Initiated Request**
- Lab enters Patient Public ID / Phone.
- Patient receives a notification and clicks "Approve".
- *Cons*: High enumeration risk. Malicious labs can spam phone numbers to verify HealthVault adoption.

**Option B: Patient-Initiated QR Pairing (RECOMMENDED)**
- Patient generates a high-entropy, short-lived "Lab Pairing Token/QR" on their device.
- Lab staff scans the QR or enters the 6-digit text equivalent.
- Backend validates the token and instantly bridges the `patientId` to the `labId`, creating an `ACTIVE` association.
- *Pros*: Zero enumeration risk. The Lab discovers the patient *only* after the patient explicitly hands over the token. Perfectly mirrors physical clinical workflows.

## 8. Association Lifecycle
- **PENDING**: Token generated but not yet consumed by a Lab.
- **ACTIVE**: Lab has successfully scanned the token; authorized to generate reports.
- **EXPIRED**: The association has passed its time-to-live.
- **REVOKED**: Patient or Lab explicitly terminated the relationship.

## 9. Database Design
A single forward-only migration will introduce:
```prisma
enum AssociationStatus {
  ACTIVE
  EXPIRED
  REVOKED
}

model PatientLabAssociation {
  id           String            @id @default(uuid()) @db.Uuid
  patientId    String            @db.Uuid
  labId        String            @db.Uuid
  status       AssociationStatus @default(ACTIVE)
  expiresAt    DateTime?
  revokedAt    DateTime?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  patient      PatientProfile    @relation(fields: [patientId], references: [id], onDelete: Restrict)
  lab          Lab               @relation(fields: [labId], references: [id], onDelete: Restrict)

  @@unique([patientId, labId])
  @@index([labId, status])
  @@index([patientId, status])
}
```
*Note: The one-time token will utilize a distinct `LabPairingToken` or reuse a modified `QRSession`.*

## 10. API Design (Proposed)

**Patient Endpoints:**
- `POST /api/patient/lab-associations/pairing-token`: Generates a short-lived QR selector/verifier.
- `GET /api/patient/lab-associations`: Lists ACTIVE/REVOKED associations.
- `PATCH /api/patient/lab-associations/:id/revoke`: Revokes the association.

**Lab Endpoints:**
- `POST /api/labs/:labId/associations/consume`: Lab submits the scanned QR token. Backend resolves patient identity, creates `ACTIVE` `PatientLabAssociation`, and returns minimal patient demographic info.
- `GET /api/labs/:labId/associations`: Lists active patients linked to this lab.

## 11. Authorization Matrix

| Operation | PATIENT | LAB_TECH | LAB_ADMIN | DOCTOR | HOSP_ADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Generate Pairing QR | ALLOW | DENY | DENY | DENY | DENY |
| Consume QR (Link) | DENY | ALLOW | ALLOW | DENY | DENY |
| List Associations | ALLOW | ALLOW | ALLOW | DENY | DENY |
| Revoke Association | ALLOW | ALLOW | ALLOW | DENY | DENY |
| Create LabReport | DENY | COND* | COND* | DENY | DENY |

*(COND = Requires ACTIVE PatientLabAssociation)*

## 12. Privacy Model
Before scanning the QR, the Lab knows nothing about the patient.
Upon scanning, the Lab receives: `firstName`, `lastName`, `dateOfBirth`, `sexAtBirth`, and `patientId`.
The Lab **DOES NOT** receive: Historical medical records, past lab reports from other labs, prescriptions, or consultations.

## 13. QR/Token Strategy
- **Entropy**: 256-bit cryptographically secure random tokens.
- **Hashing**: Database stores the hash (`tokenHash`); QR contains the raw `token`.
- **Lifetime**: Strictly limited to 15 minutes.
- **Single-Use**: Once consumed by `POST /consume`, the token is immediately invalidated/deleted.

## 14. Audit Strategy
The `AuditLog` will track:
- `LAB_ASSOCIATION_CREATED` (Actor: Lab Tech, Target: Association)
- `LAB_ASSOCIATION_REVOKED` (Actor: Patient or Lab)
No raw tokens or secrets will be logged.

## 15. Access Logging
`AccessLog` is utilized when clinical data is *viewed* or *downloaded*. Since creating an association does not immediately expose historical clinical data, an `AuditLog` is sufficient for the pairing event. `AccessLog` will continue to guard the actual `LabReport` views.

## 16. Threat Model
| Threat | Impact | Mitigation |
| :--- | :--- | :--- |
| **1. Patient ID Enumeration** | High. Malicious labs scan for patient presence. | **Option B** prevents this. Labs cannot search by ID/Phone; they must be handed a 256-bit token. |
| **2. Replayed Token** | Medium. Attacker reuses a QR code. | Tokens are strictly single-use. The database transaction deletes/invalidates the token during the consume phase. |
| **3. Stolen QR Code** | High. Eavesdropper intercepts QR. | 15-minute TTL limits the window. Visual verification at the lab desk provides physical mitigation. |
| **4. Lab A accesses Lab B Association** | High. Cross-tenant leakage. | Controller strictly enforces `labId` matches the authenticated `LabMembership`. |
| **5. Cross-Patient Report Creation** | Critical. Falsified medical records. | `LabController.createReport` will be updated to require an `ACTIVE` `PatientLabAssociation` for the exact `[labId, patientId]`. |

## 17. Race Conditions
- **Concurrent Consume**: Two labs scanning the same QR simultaneously. Handled by a Prisma `$transaction` applying a unique constraint or deleting the token with `WHERE status = 'PENDING'`, ensuring only one wins.
- **Revoke vs Report Creation**: If a patient revokes an association while a tech is saving a report, the `createReport` transaction must actively check `status === ACTIVE` immediately before writing the `MedicalRecord`.

## 18. Revocation
If a patient clicks "Revoke", the association `status` becomes `REVOKED`. 
- **Future**: The lab can no longer create new reports.
- **Historical**: Existing `FINALIZED` reports remain valid and intact (medical history is immutable). Drafts might be locked from further edits, or allowed to be finalized based on clinic policy (prototype will lock them).

## 19. Expiration
For a prototype, the association can remain `ACTIVE` indefinitely until explicitly revoked by the patient or lab, mirroring a "primary lab" relationship. Alternatively, a 1-year TTL could be enforced.

## 20. Multi-Lab Behavior
Patient A can have active associations with Lab X and Lab Y simultaneously.
Due to `@@unique([patientId, labId])`, these are strictly distinct records. Lab X cannot query Lab Y's association.

## 21. Multi-Patient Behavior
A Lab will have associations with Patient A, Patient B, and Patient C. The lab can list its own associations (`GET /api/labs/:labId/associations`), securely paginating only its established patients without exposing the broader HealthVault directory.

## 22. Frontend UX
- **Patient (`/lab-connections`)**: A dashboard showing active lab links, with a prominent "Generate Lab QR" button.
- **Lab (`/lab/patients`)**: A tabular view of connected patients, with a "Scan Patient QR" button that opens a camera/text input modal.

## 23. ABDM/FHIR Future Boundary
By encapsulating the relationship in `PatientLabAssociation`, we create a clean mapping boundary. In the future, a FHIR `Consent` resource or ABDM `HIP/HIU` linkage can be mapped directly to this association table without touching the core `MedicalRecord` logic.

## 24. Migration Plan
A pure forward-only migration will be created adding `PatientLabAssociation` and `LabPairingToken`. No existing data will be mutated.

## 25. Security Assumptions
- TLS is enforced in transit to protect the short-lived token.
- Patient devices are secure (malware cannot steal the QR before presentation).

## 26. Known Limitations
- If a patient is unconscious in an emergency, they cannot generate a QR code. A separate "Break Glass" emergency workflow (out of scope for this explicit pairing) would be required for emergency lab work.

## 27. Implementation Plan for Step 20B
1. Generate Prisma Migration for `PatientLabAssociation` and `LabPairingToken`.
2. Implement backend generation and consumption endpoints with strict TOCTOU transactional safeguards.
3. Update `LabController.createReport` to require an `ACTIVE` association.
4. Build Patient and Lab frontend UX components for scanning/generating.
5. Execute full regression and security penetration testing on the pairing flow.
