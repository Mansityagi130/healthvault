CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_hospitalId_name_key" ON "Department"("hospitalId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Hospital_code_key" ON "Hospital"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "HospitalMembership_hospitalId_userId_departmentId_key" ON "HospitalMembership"("hospitalId", "userId", "departmentId");
