import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

export class DatabaseConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export const createPrismaClient = (connectionString: string): PrismaClient => {
  const adapter = new PrismaPg({ connectionString });

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
