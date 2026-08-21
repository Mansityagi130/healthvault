# HealthVault architecture

## 1. Project purpose

HealthVault is a patient-first digital health record wallet for India. It will help patients manage their own records and selectively share them. It complements, rather than replaces, ABHA and ABDM.

## 2. Frontend architecture

The `frontend` application uses Next.js with TypeScript, the App Router, and Tailwind CSS. At this stage it contains only a static landing page. Future patient, doctor, hospital, and administrator experiences will be organised as route segments and will consume the backend REST API.

## 3. Backend architecture

The `backend` application is an Express TypeScript service. `app.ts` composes middleware and routes; controllers handle HTTP requests; services hold business logic; repositories will isolate data access; schemas validate inputs; and middleware provides cross-cutting concerns such as errors and request logging.

## 4. Database architecture

PostgreSQL is the planned system of record. Prisma, database models, migrations, and database access are deliberately deferred to the next development stage. The API's repository boundary keeps future persistence concerns separate from HTTP handling.

## 5. API architecture

The API is version-ready and currently exposes `GET /api/health`. Routes are grouped under `/api`; controllers return transport responses; errors flow to one centralized error handler. New endpoints should validate untrusted input with Zod schemas before invoking services.

## 6. Future authentication layer

Authentication will establish identity for patients and portal users, and authorization will enforce the minimum permissions required for each action. Token storage, rotation, session management, password policy, and account recovery will be designed before implementation.

## 7. Future consent engine

A consent engine will model patient-granted scopes, purposes, recipients, durations, revocation, and the evidence needed to enforce each sharing decision. Consent checks will be required before protected records are disclosed.

## 8. Future QR sharing

Temporary QR sharing will use short-lived, revocable, narrowly scoped references rather than embedding protected medical data in a QR code. It will integrate with consent and audit controls.

## 9. Future audit logging

Audit events will record security-relevant access and sharing actions with actor, action, target, timestamp, outcome, and contextual metadata. Logs will be protected against unauthorized modification and access.

## 10. Future ABDM integration

Any ABDM integration will be scoped and designed against official specifications available at that time. This project does not assume or invent ABDM APIs.

## 11. Security principles

- Patient control and least privilege
- Defense in depth and secure defaults
- Input validation and centralized error handling
- Secrets kept out of source control and frontend bundles
- Encryption and secure transport when sensitive data is introduced
- Traceability through appropriate audit controls
- Privacy-by-design and minimum necessary data handling
