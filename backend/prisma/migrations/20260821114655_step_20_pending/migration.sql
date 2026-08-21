-- AlterEnum
ALTER TYPE "AssociationStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "PatientLabAssociation" ALTER COLUMN "status" SET DEFAULT 'PENDING';
