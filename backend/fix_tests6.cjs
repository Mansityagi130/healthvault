const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');

c = c.replace(/registrationNumber: "12345"/g, 'registrationNumber: "12345_" + email');

fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
