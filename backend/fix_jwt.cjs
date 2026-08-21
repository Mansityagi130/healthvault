const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');

c = c.replace(/import jwt from "jsonwebtoken";/g, 'import jwt from "jsonwebtoken";\nimport { env } from "../src/config/env.js";');

c = c.replace(/const token = jwt\.sign\(\{ id: user\.id, email: user\.email, role: "PATIENT" \}, process\.env\.JWT_SECRET \|\| "supersecret", \{ expiresIn: "1h" \}\);/g, 'const token = jwt.sign({ sub: user.id, sessionId: "mock", type: "access" }, env.JWT_ACCESS_SECRET, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, expiresIn: "1h" });');

c = c.replace(/const token = jwt\.sign\(\{ id: user\.id, email: user\.email \}, process\.env\.JWT_SECRET \|\| "supersecret", \{ expiresIn: "1h" \}\);/g, 'const token = jwt.sign({ sub: user.id, sessionId: "mock", type: "access" }, env.JWT_ACCESS_SECRET, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, expiresIn: "1h" });');

fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
