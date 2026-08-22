# HealthVault

HealthVault is a patient-first digital health record wallet designed for India's digital health infrastructure. It provides patients with sovereign ownership, secure storage, and consent-driven sharing of their medical records. Developed as a production-oriented security prototype, HealthVault implements robust security boundaries, multi-factor authentication (MFA), clinical data integrity rules, and FHIR R4 standard interoperability.

## Live Demo
*   **Frontend Demo**: *Placeholder for Vercel Deployment URL*
*   **API Endpoint**: *Placeholder for Render Deployment URL*

## GitHub Repository
*   **Source Code**: *Placeholder for GitHub Repository URL*

---

## 1. Key Features

### Security & Access Control
*   **TOTP-Based MFA**: Compatible with Google Authenticator, Microsoft Authenticator, and standard RFC 6238 apps. Secrets are encrypted at-rest using AES-256-GCM.
*   **MFA-Pending Constraints**: Restrictive authentication token family prevents access to any medical or user resource until MFA verification succeeds.
*   **Secure Password Reset**: One-hour tokens distributed asynchronously with generic response messages to prevent account enumeration.
*   **Session Revocation**: Disabling MFA preserves the current user session while immediately terminating all other active sessions.

### Multi-Tenant Access Boundaries
*   **Role-Based Access Control (RBAC)**: Fine-grained roles including `PATIENT`, `DOCTOR`, `HOSPITAL_ADMIN`, `STAFF`, `LAB_USER`, and `LAB_ADMIN`.
*   **Tenant Isolation**: Strict boundaries between different patients, hospital networks, clinics, and laboratories. All queries verify patient, provider, or hospital ownership.

### Clinical Workflows
*   **Encounters**: Track lifecycle status (`PLANNED`, `IN_PROGRESS`, `FINISHED`, `CANCELLED`). Completed or cancelled encounters are immutable.
*   **Diagnostics & Prescriptions**: Securely attach doctor consultations, diagnostic imaging records, and prescriptions to user profiles.
*   **Laboratory Integration**: Manage patient-lab association requests. Labs can publish draft reports and finalize them with validated results.
*   **Immutability Auditing**: Finalized laboratory reports and verified provider records are locked to prevent tampering.

### File Safety & Malware Pipeline
*   **Quarantine on Upload**: All uploaded medical documents are placed under quarantine by default.
*   **Asynchronous Scan Queue**: Built on Redis + BullMQ. Background workers process file scans statefully.
*   **EICAR Antivirus Scanner**: Integrated signature checks. Files containing infected code are flagged, quarantined permanently, and blocked from downloads. Only `CLEAN` documents can be downloaded or exported.

### Interoperability & Integrations
*   **FHIR R4 Interoperability**: Exports consolidated patient records in standard FHIR R4 Bundle formats.
*   **ABDM Foundation**: Software layouts matching Ayushman Bharat Digital Mission (ABDM) guidelines for external consent management.

---

## 2. System Architecture

```
                  [ Web Browser Client ]
                            │
                            ▼ (HTTPS)
                       [ Nginx ] (Reverse Proxy Gateway)
                       /       \
       (Path: /*)     /         \ (Path: /api/*)
                     ▼           ▼
             [ Next.js ]   [ Express.js API ]
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼ (Redis TCP)
             [ PostgreSQL ]              [ Redis ] (BullMQ)
             (Via Prisma)                    │
                                             ▼
                                     [ Outbox Poller ] ──► [ Background Workers ]
```

*   **Next.js Frontend**: Implements the user portal, dashboard views, QR code scanning, and MFA controls.
*   **Express Backend**: High-performance JSON API.
*   **PostgreSQL**: Stores relational models, clinical records, audit logs, and authentication states.
*   **Prisma Client**: Type-safe query engine.
*   **Redis & BullMQ**: Manages delayed and background tasks (document scanning and notification outbox delivery).
*   **Outbox Poller**: Uses the Transactional Outbox pattern to run jobs reliably without dropping events when Redis or external networks are unavailable.

---

## 3. Technology Stack

*   **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide Icons, QRCode.react.
*   **Backend**: Node.js 20, Express, Zod (Schema validation), Jose/JWT (Bearer tokens), Otplib (TOTP).
*   **Database**: PostgreSQL, Prisma ORM.
*   **Background Jobs**: Redis, BullMQ.
*   **Security & Headers**: Helmet, Express Rate Limit, Cookie Parser.
*   **Testing**: Vitest, Supertest.

---

## 4. Testing & Verification

HealthVault has a comprehensive test suite covering authentication, RBAC boundaries, file safety pipelines, and data immutability:

*   **Unit & Integration Tests**: **164/164 tests passing** successfully.
*   **Compilation Verification**: Clean build compilation for both backend and frontend.

### To Run Tests Locally:
```bash
cd backend
npm run build
npm test
```

---

## 5. Local Setup

### Prerequisites
*   Node.js 20+
*   PostgreSQL Database
*   Redis Server

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/.../healthvault.git
    cd healthvault
    ```
2.  **Configure environment files**:
    Create `.env` inside `backend/` using the template:
    ```bash
    cd backend
    cp .env.example .env
    ```
3.  **Install dependencies**:
    ```bash
    # Backend
    cd backend && npm install
    # Frontend
    cd ../frontend && npm install
    ```
4.  **Run Prisma migrations**:
    ```bash
    cd backend
    npx prisma migrate dev
    ```
5.  **Start application in development mode**:
    ```bash
    # Run backend
    cd backend && npm run dev
    # Run frontend (in a separate terminal)
    cd frontend && npm run dev
    ```

---

## 6. Docker Deployment

The application is fully containerized for local staging and VPS deployment:
*   Build image: `docker compose build`
*   Start services: `docker compose up -d`
*   Apply migrations inside container: `docker compose exec backend npx prisma migrate deploy`

Only the Nginx service exposes port `80` publicly. PostgreSQL, Redis, and Backend services remain private inside Docker's internal bridge network.

---

## 7. Cloud Deployment (Target Staging)

HealthVault is designed to be hosted on free/low-cost staging platforms:
*   **Frontend**: Hosted on **Vercel** connected directly to the GitHub repository.
*   **Backend API**: Hosted on **Render** (Node web service).
*   **Relational Database**: Managed PostgreSQL (e.g., Neon serverless Postgres).
*   **Background Cache**: Managed Redis (e.g., Upstash Redis).

### Demo Limitations
*   *Mock Malware Scanner*: Simulated virus detection using EICAR strings.
*   *Mock ABDM Adapter*: Simulates NHA gateway connectivity.
*   *Ephemeral Storage*: Next.js/Render files are transient. Document uploads are stored locally and will clear on server recycling.
*   *Console Email Transport*: Transactional notifications are written to stdout logs instead of sending real SMTP emails.

---

## 8. Future Roadmap

1.  **AWS S3 storage**: Migrate `StorageProvider` to AWS S3-compatible cloud storage to persist records across serverless restarts.
2.  **ClamAV Scanning daemon**: Run ClamAV container sidecar for real antivirus signatures check.
3.  **Real ABDM Gateway Integration**: Connect to NHA sandbox APIs.
4.  **AWS Secrets Manager**: Rotate database, JWT, and encryption keys securely.
