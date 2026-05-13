export interface FileEntry {
  id: string;   // Drive file ID or S3 object key
  mtime: Date;
}

export interface StorageProvider {
  readonly name: string;
  listFiles(): Promise<Map<string, FileEntry>>;
  downloadFile(id: string): Promise<Buffer>;
  /** existingId=null → create new; non-null → update in place */
  uploadFile(
    relativePath: string,
    content: Buffer,
    mtime: Date,
    mimeType: string,
    existingId: string | null,
  ): Promise<void>;
  deleteFile(id: string): Promise<void>;
}
