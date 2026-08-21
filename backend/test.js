const { PrismaClient } = require('./node_modules/@prisma/client'); const prisma = new PrismaClient(); prisma.hospital.count().then(console.log).finally(() => prisma.\())
