-- CreateEnum
CREATE TYPE "ExternalTransactionStatus" AS ENUM ('REQUESTED', 'AUTHORIZING', 'AUTHORIZED', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ExternalExchangeTransaction" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" "ExternalTransactionStatus" NOT NULL DEFAULT 'REQUESTED',
    "correlationId" TEXT,
    "payload" JSONB,
    "errorMessage" TEXT,
    "patientId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalExchangeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbdmConsent" (
    "id" UUID NOT NULL,
    "artefactId" TEXT NOT NULL,
    "patientId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "signature" TEXT,
    "grantedCategories" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbdmConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalExchangeTransaction_correlationId_key" ON "ExternalExchangeTransaction"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "AbdmConsent_artefactId_key" ON "AbdmConsent"("artefactId");

-- AddForeignKey
ALTER TABLE "ExternalExchangeTransaction" ADD CONSTRAINT "ExternalExchangeTransaction_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbdmConsent" ADD CONSTRAINT "AbdmConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
