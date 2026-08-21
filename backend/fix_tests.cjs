const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');

c = c.replace(/send\(\{ email, password: "password123", role: "PATIENT" \}\)/g, 'send({ email, password: "password123", role: "PATIENT", firstName: "Test", lastName: "User" })');
c = c.replace(/send\(\{ email, password: "password123", role: "PROVIDER" \}\)/g, 'send({ email, password: "password123", role: "PROVIDER", firstName: "Test", lastName: "User", medicalLicenseNumber: "123" })');

fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
