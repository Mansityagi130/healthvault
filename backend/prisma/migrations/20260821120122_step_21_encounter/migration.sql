-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EncounterStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "EncounterStatus" ADD VALUE 'IN_PROGRESS';

-- CreateTable
CREATE TABLE "RegistrationPairingToken" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "selector" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationPairingToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPairingToken_selector_key" ON "RegistrationPairingToken"("selector");

-- AddForeignKey
ALTER TABLE "RegistrationPairingToken" ADD CONSTRAINT "RegistrationPairingToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
