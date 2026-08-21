/*
  Warnings:

  - The required column `familyId` was added to the `AuthSession` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "familyId" UUID NOT NULL;
