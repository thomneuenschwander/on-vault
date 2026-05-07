import 'dotenv/config';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import {
  createDriveClient,
  listDriveFolder,
  downloadFile,
} from './drive';
import { loadConfig } from './config';

function generateDefaultIndex(title: string): string {
  return `---
title: ${title}
description: Browse and explore the notes
---

Welcome to **${title}**. Use the sidebar to navigate the notes.
`;
}

async function fetchContent() {
  const config = loadConfig();
  const basePath = config.site.base_path ?? 'docs';
  const contentDir = join(process.cwd(), 'content', basePath);
  const vaultCacheDir = join(process.cwd(), '.vault-cache');
  const publicVaultDir = join(process.cwd(), 'public', 'vault');

  // Clean previous runs
  for (const dir of [vaultCacheDir, contentDir, publicVaultDir]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
  }

  const drive = createDriveClient();

  console.log(`Fetching vault from Google Drive...`);

  const allFiles = new Map();
  await listDriveFolder(drive, config.google_drive.folder_id, '', allFiles);
  console.log(`Found ${allFiles.size} files in Drive\n`);

  for (const [relativePath, file] of allFiles) {
    const targetPath = join(vaultCacheDir, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    const content = await downloadFile(drive, file.id);
    writeFileSync(targetPath, content);
    console.log(`  > ${relativePath}`);
  }

  console.log(`\nProcessing vault with fumadocs-obsidian...`);

  // dynamic import: fumadocs-obsidian is ESM-only, scripts run as CJS
  const { fromVault } = await import('fumadocs-obsidian');

  await fromVault({
    dir: vaultCacheDir,
    out: {
      contentDir,
      publicDir: publicVaultDir,
    },
    convert: {
      // make asset URLs resolve under /vault/
      url: (outputPath) => `/vault/${outputPath}`,
    },
  });

  // Generate a default landing page if the vault has no index.md
  const indexPath = join(contentDir, 'index.mdx');
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, generateDefaultIndex(config.site.title ?? 'My Notes'), 'utf-8');
    console.log(`  > index.mdx (generated)`);
  }

  // Cleanup temp vault dir
  rmSync(vaultCacheDir, { recursive: true });

  console.log(`\nDone: content/${basePath}/ ready for build`);
}

fetchContent().catch((err) => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
