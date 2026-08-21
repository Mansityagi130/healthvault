const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');
c = c.replace(/await prisma.auditLog.deleteMany\(\{\}\);/g, "await prisma.auditLog.deleteMany({});\n    await prisma.medicalRecord.deleteMany({});\n    await prisma.sharingSession.deleteMany({});\n    await prisma.consent.deleteMany({});\n    await prisma.consentRequest.deleteMany({});");
fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
