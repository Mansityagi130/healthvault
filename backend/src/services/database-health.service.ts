export type DatabaseHealthStatus = "ok" | "unavailable";

export interface DatabaseHealthChecker {
  ping(): Promise<void>;
}

export interface DatabaseHealth {
  status: DatabaseHealthStatus;
}

export const getDatabaseHealth = async (
  databaseHealthChecker: DatabaseHealthChecker
): Promise<DatabaseHealth> => {
  try {
    await databaseHealthChecker.ping();
    return { status: "ok" };
  } catch {
    return { status: "unavailable" };
  }
};
