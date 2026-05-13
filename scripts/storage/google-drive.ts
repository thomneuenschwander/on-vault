import { Readable } from 'stream';
import { dirname } from 'path';
import {
  createDriveClient,
  listDriveFolder,
  downloadFile as driveDownload,
  ensureFolderPath,
} from '../drive';
import type { StorageProvider, FileEntry } from './interface';

export function createGoogleDriveProvider(folderId: string): StorageProvider {
  const drive = createDriveClient();
  const folderCache = new Map<string, string>();

  return {
    name: 'Google Drive',

    async listFiles(): Promise<Map<string, FileEntry>> {
      const raw = new Map<string, { id: string; modifiedTime: string }>();
      await listDriveFolder(drive, folderId, '', raw as any);
      const result = new Map<string, FileEntry>();
      for (const [relativePath, file] of raw) {
        result.set(relativePath, { id: file.id, mtime: new Date(file.modifiedTime) });
      }
      return result;
    },

    async downloadFile(id: string): Promise<Buffer> {
      return driveDownload(drive, id);
    },

    async uploadFile(
      relativePath: string,
      content: Buffer,
      _mtime: Date,
      mimeType: string,
      existingId: string | null,
    ): Promise<void> {
      const body = Readable.from(content);
      if (existingId) {
        await drive.files.update({
          fileId: existingId,
          media: { mimeType, body },
          supportsAllDrives: true,
        });
      } else {
        const parentId = await ensureFolderPath(drive, dirname(relativePath), folderId, folderCache);
        const name = relativePath.split('/').pop()!;
        await drive.files.create({
          requestBody: { name, parents: [parentId] },
          media: { mimeType, body },
          supportsAllDrives: true,
        });
      }
    },

    async deleteFile(id: string): Promise<void> {
      await drive.files.delete({ fileId: id, supportsAllDrives: true });
    },
  };
}
