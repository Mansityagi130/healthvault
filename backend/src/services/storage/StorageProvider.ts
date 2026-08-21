export interface StorageProvider {
  /**
   * Upload a file and return the storage key
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  
  /**
   * Get a file's content
   */
  get(key: string): Promise<Buffer>;
  
  /**
   * Delete a file
   */
  delete(key: string): Promise<void>;
  
  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;
  
  /**
   * Create a signed URL for secure access (if supported by provider)
   */
  createSignedAccessUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
