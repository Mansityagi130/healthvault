const fs = require('fs');
let c1 = fs.readFileSync('src/controllers/encounter.controller.ts', 'utf8');
c1 = c1.replace(/import \{ Encounter, EncounterStatus, EncounterType, PrismaClient \} from "\.\.\/generated\/prisma\/client\.js";\r?\nimport \{ AuthRequest \} from "\.\.\/middleware\/auth\.middleware";\r?\nimport \{ Response \} from "express";\r?\n\r?\nconst prisma = new PrismaClient\(\);/, 'import { Encounter, EncounterStatus, EncounterType } from "../generated/prisma/client.js";\nimport { databaseClient as prisma } from "../config/database.js";\nimport { AuthRequest } from "../middleware/auth.middleware.js";\nimport { Response } from "express";');
fs.writeFileSync('src/controllers/encounter.controller.ts', c1, 'utf8');

let c2 = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');
c2 = c2.replace(/import \{ PrismaClient, MembershipRole, EncounterType, EncounterStatus \} from "\.\.\/src\/generated\/prisma\/client\.js";\r?\nimport jwt from "jsonwebtoken";\r?\n\r?\nconst prisma = new PrismaClient\(\);/, 'import { MembershipRole, EncounterType, EncounterStatus } from "../src/generated/prisma/client.js";\nimport { databaseClient as prisma } from "../src/config/database.js";\nimport jwt from "jsonwebtoken";');
fs.writeFileSync('tests/encounter.integration.test.ts', c2, 'utf8');
