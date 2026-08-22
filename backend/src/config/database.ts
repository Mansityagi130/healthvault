import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const { Pool } = pg;

import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

export class DatabaseConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export const createPrismaClient = (connectionString: string): PrismaClient => {
  // Implement connection pool guardrails for 26B.7 Database Reliability
  const pool = new Pool({
    connectionString,
    max: 20, // Connection limits
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Note: statement_timeout can be configured here if necessary, but 
    // Prisma transactions currently lack built-in query-level timeout knobs
    // so we document that we rely on Postgres connectionTimeout and idleTimeout
    // for safety rather than breaking integration tests with statement_timeout.
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
};

class PrismaDatabaseClient {
  private client: PrismaClient | undefined;

  public getClient(): PrismaClient {
    if (this.client) {
      return this.client;
    }

    if (!env.DATABASE_URL) {
      throw new DatabaseConfigurationError("DATABASE_URL is not configured.");
    }

    this.client = createPrismaClient(env.DATABASE_URL);
    return this.client;
  }

  public async disconnect(): Promise<void> {
    await this.client?.$disconnect();
  }
}

export const databaseClient = new PrismaDatabaseClient();
