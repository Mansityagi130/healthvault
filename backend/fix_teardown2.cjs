const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');

c = c.replace(/await prisma\.auditLog\.deleteMany[\s\S]*?await prisma\.user\.deleteMany\(\{\}\);/g, "const tables = ['AuditLog', 'MedicalRecord', 'SharingSession', 'SharingSessionScope', 'Consent', 'ConsentScope', 'ConsentRequest', 'ConsentRequestScope', 'AccessLog', 'HospitalMembership', 'Department', 'Hospital', 'PatientProfile', 'DoctorProfile', 'User', 'Encounter'];\n    for (const table of tables) {\n      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \"${table}\" CASCADE`);\n    }");

fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
