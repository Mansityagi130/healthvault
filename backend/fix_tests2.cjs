const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');

c = c.replace(/const pat = await prisma\.patientProfile\.create\(\{ data: \{ userId: user!\.id, firstName: "Pat", lastName: email \} \}\);/g, 'const pat = await prisma.patientProfile.findUnique({ where: { userId: user!.id } });');
c = c.replace(/await prisma\.doctorProfile\.create\(\{ data: \{ userId: user!\.id, firstName: "Doc", lastName: email \} \}\);/g, '');

fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
