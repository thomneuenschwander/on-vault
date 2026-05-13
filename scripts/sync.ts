import 'dotenv/config';
import { readFileSync, statSync, readdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { homedir } from 'os';
import { loadConfig } from './config';
import { createStorageProvider } from './storage';

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

function getFileContent(absolutePath: string, filename: string): { mimeType: string; content: Buffer } {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const mimeType = MIME_MAP[ext] ?? (BINARY_EXTENSIONS.has(ext) ? 'application/octet-stream' : 'text/plain; charset=utf-8');
  return { mimeType, content: readFileSync(absolutePath) };
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
      files.push({ absolutePath, relativePath: relative(vaultRoot, absolutePath), name: entry.name });
    }
  }
  return files;
}

async function sync() {
  const config = loadConfig();

  if (config.storage?.sync_enabled === false) {
    console.log('Sync is disabled (storage.sync_enabled: false). Skipping upload.');
    return;
  }

  const vaultPath = expandPath(config.vault.path);
  const force = process.argv.includes('--force');
  const syncConfig = config.vault.sync_config ?? false;

  const provider = await createStorageProvider(config);

  console.log(`Syncing ${vaultPath} → ${provider.name}${force ? ' (--force)' : ''}${syncConfig ? ' (including .obsidian)' : ''}`);

  const localFiles = collectLocalFiles(vaultPath, vaultPath, syncConfig);
  console.log(`Local: ${localFiles.length} files`);

  console.log(`Fetching ${provider.name} file list...`);
  const remoteFiles = await provider.listFiles();
  console.log(`Remote: ${remoteFiles.size} files\n`);

  const localPathSet = new Set(localFiles.map((f) => f.relativePath));

  let uploaded = 0;
  let updated = 0;
  let deleted = 0;
  let unchanged = 0;

  for (const localFile of localFiles) {
    const remoteFile = remoteFiles.get(localFile.relativePath);
    const localMtime = statSync(localFile.absolutePath).mtime;

    if (!remoteFile) {
      const { mimeType, content } = getFileContent(localFile.absolutePath, localFile.name);
      await provider.uploadFile(localFile.relativePath, content, localMtime, mimeType, null);
      console.log(`  + ${localFile.relativePath}`);
      uploaded++;
    } else if (force || localMtime > remoteFile.mtime) {
      const { mimeType, content } = getFileContent(localFile.absolutePath, localFile.name);
      await provider.uploadFile(localFile.relativePath, content, localMtime, mimeType, remoteFile.id);
      console.log(`  ~ ${localFile.relativePath}`);
      updated++;
    } else {
      unchanged++;
    }
  }

  for (const [relativePath, remoteFile] of remoteFiles) {
    if (!localPathSet.has(relativePath)) {
      await provider.deleteFile(remoteFile.id);
      console.log(`  - ${relativePath}`);
      deleted++;
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${updated} updated, ${deleted} deleted, ${unchanged} unchanged`);
}

sync().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
