const fs = require('fs');

let c1 = fs.readFileSync('src/controllers/encounter.controller.ts', 'utf8');
c1 = c1.replace('import { databaseClient as prisma } from "../config/database.js";', 'import { databaseClient } from "../config/database.js";\nconst prisma = databaseClient.getClient();');
fs.writeFileSync('src/controllers/encounter.controller.ts', c1, 'utf8');

let c2 = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');
c2 = c2.replace('import { databaseClient as prisma } from "../src/config/database.js";', 'import { databaseClient } from "../src/config/database.js";\nconst prisma = databaseClient.getClient();');
fs.writeFileSync('tests/encounter.integration.test.ts', c2, 'utf8');
