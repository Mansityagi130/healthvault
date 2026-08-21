const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');

c = c.replace(/firstName: "Doc", lastName: email, /g, '');

fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
