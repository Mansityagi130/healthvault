# HealthVault

HealthVault is a patient-first digital health record wallet for India. It is designed to help patients manage and share their health records under their control. It is not a replacement for ABHA or ABDM.

## Current development stage

This repository contains the software foundation only: a Next.js landing page and an Express API health check. It is a development prototype, not a production healthcare system.

## Technology stack

- Frontend: Next.js, TypeScript, App Router, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Validation: Zod
- Testing: Vitest and Supertest
- Database (planned): PostgreSQL with Prisma

## Folder structure

```text
healthvault/
├── frontend/       # Next.js patient-facing application foundation
├── backend/        # Express REST API foundation
├── docs/           # Architecture documentation
├── .gitignore
└── README.md
```

## Local setup

Prerequisites: Node.js 22+, npm, and PostgreSQL (not yet connected in this stage).

Install dependencies in each application directory:

```bash
cd frontend && npm install
cd ../backend && npm install
```

Copy the backend environment template before starting the API:

```bash
cd backend
copy .env.example .env
```

## Start the frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000.

## Start the backend

```bash
cd backend
npm run dev
```

The API health endpoint is available at http://localhost:5000/api/health.

## Security disclaimer

Do not use this prototype to store, process, or share real patient data. Authentication, authorization, consent enforcement, encryption, audit controls, and production operational safeguards have not yet been implemented.

## Future roadmap

- PostgreSQL and Prisma data architecture
- Authentication and role-based access
- Patient records and consent management
- Temporary QR sharing and audit logging
- OCR/AI document processing
- ABDM integration assessment and implementation
