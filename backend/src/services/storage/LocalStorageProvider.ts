import fs from "fs/promises";
import path from "path";
import type { StorageProvider } from "./StorageProvider.js";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export class LocalStorageProvider implements StorageProvider {
  constructor() {
    // Ensure root exists
    fs.mkdir(STORAGE_ROOT, { recursive: true }).catch(console.error);
  }

  private getFilePath(key: string) {
    // Prevent path traversal securely
    const resolvedPath = path.resolve(STORAGE_ROOT, key);
    if (!resolvedPath.startsWith(path.resolve(STORAGE_ROOT))) {
      throw new Error("Invalid storage key - path traversal detected");
    }
    return resolvedPath;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const filePath = this.getFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.unlink(filePath).catch((err) => {
      if (err.code !== "ENOENT") throw err;
    });
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async createSignedAccessUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    // Local provider doesn't support real signed URLs easily without a backend route.
    // The backend route itself will serve the file and authorize it.
    // For this prototype, we'll just return a dummy or relative path that the frontend uses 
    // to call the secure backend GET endpoint instead of a direct storage URL.
    return `/api/patient/documents/${key}`; 
  }
}

export const storage = new LocalStorageProvider();
