import 'dotenv/config';
import { readFileSync, statSync, readdirSync } from 'fs';
import { Readable } from 'stream';
import { join, relative, dirname } from 'path';
import { homedir } from 'os';
import {
  createDriveClient,
  listDriveFolder,
  ensureFolderPath,
  type DriveFile,
} from './drive';
import { loadConfig } from './config';

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff', 'tif',
  'mp4', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'zip', 'tar', 'gz', 'pdf',
]);

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  json: 'application/json',
  excalidraw: 'application/json',
};

function getFileMedia(absolutePath: string, filename: string): { mimeType: string; body: string | Readable } {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const mimeType = MIME_MAP[ext] ?? (BINARY_EXTENSIONS.has(ext) ? 'application/octet-stream' : 'text/plain; charset=utf-8');
  if (BINARY_EXTENSIONS.has(ext)) {
    return { mimeType, body: Readable.from(readFileSync(absolutePath)) };
  }
  return { mimeType, body: readFileSync(absolutePath, 'utf-8') };
}

interface LocalFile {
  absolutePath: string;
  relativePath: string;
  name: string;
}

function expandPath(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

// workspace.json/.mobile change on every Obsidian open — pure UI state, not worth syncing
const ALWAYS_SKIP = new Set(['.trash', 'workspace.json', 'workspace-mobile.json']);

function collectLocalFiles(dirPath: string, vaultRoot: string, syncConfig: boolean): LocalFile[] {
  const files: LocalFile[] = [];

  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (ALWAYS_SKIP.has(entry.name)) continue;
    if (!syncConfig && entry.name.startsWith('.')) continue;

    const absolutePath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectLocalFiles(absolutePath, vaultRoot, syncConfig));
    } else if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath: relative(vaultRoot, absolutePath),
        name: entry.name,
      });
    }
  }

  return files;
}

async function sync() {
  const config = loadConfig();
  const vaultPath = expandPath(config.vault.path);
  const rootFolderId = config.google_drive.folder_id;
  const force = process.argv.includes('--force');
  const syncConfig = config.vault.sync_config ?? false;

  const drive = createDriveClient();

  console.log(`Syncing ${vaultPath} → Google Drive${force ? ' (--force)' : ''}${syncConfig ? ' (including .obsidian)' : ''}`);

  const localFiles = collectLocalFiles(vaultPath, vaultPath, syncConfig);
  console.log(`Local: ${localFiles.length} files`);

  console.log('Fetching Drive file list...');
  const driveFileMap = new Map<string, DriveFile>();
  await listDriveFolder(drive, rootFolderId, '', driveFileMap);
  console.log(`Drive: ${driveFileMap.size} files\n`);

  const localPathSet = new Set(localFiles.map((f) => f.relativePath));
  const folderCache = new Map<string, string>();

  let uploaded = 0;
  let updated = 0;
  let deleted = 0;
  let unchanged = 0;

  for (const localFile of localFiles) {
    const driveFile = driveFileMap.get(localFile.relativePath);
    const localMtime = statSync(localFile.absolutePath).mtime;

    if (!driveFile) {
      const parentId = await ensureFolderPath(
        drive,
        dirname(localFile.relativePath),
        rootFolderId,
        folderCache
      );
      const { mimeType, body } = getFileMedia(localFile.absolutePath, localFile.name);
      await drive.files.create({
        requestBody: { name: localFile.name, parents: [parentId] },
        media: { mimeType, body },
        supportsAllDrives: true,
      });
      console.log(`  + ${localFile.relativePath}`);
      uploaded++;
    } else if (force || localMtime > new Date(driveFile.modifiedTime)) {
      const { mimeType, body } = getFileMedia(localFile.absolutePath, localFile.name);
      await drive.files.update({
        fileId: driveFile.id,
        media: { mimeType, body },
        supportsAllDrives: true,
      });
      console.log(`  ~ ${localFile.relativePath}`);
      updated++;
    } else {
      unchanged++;
    }
  }

  for (const [relativePath, driveFile] of driveFileMap) {
    if (!localPathSet.has(relativePath)) {
      await drive.files.delete({ fileId: driveFile.id, supportsAllDrives: true });
      console.log(`  - ${relativePath}`);
      deleted++;
    }
  }

  console.log(
    `\nDone: ${uploaded} uploaded, ${updated} updated, ${deleted} deleted, ${unchanged} unchanged`
  );
}

sync().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
