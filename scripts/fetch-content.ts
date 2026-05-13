import 'dotenv/config';
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { loadConfig } from './config';
import { createStorageProvider } from './storage';

// Simple glob matcher supporting * (single segment) and ** (any depth).
function matchesGlob(filePath: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars except *
    .replace(/\*\*\//g, '(.+/)?')          // **/ → optional path prefix
    .replace(/\*\*/g, '.*')                // ** → any depth
    .replace(/\*/g, '[^/]*');              // * → single path segment
  return new RegExp(`^${regexStr}$`).test(filePath);
}

function applyExcludePatterns(allFiles: Map<string, unknown>, patterns: string[]): void {
  if (patterns.length === 0) return;
  let excluded = 0;
  for (const relativePath of allFiles.keys()) {
    if (patterns.some((p) => matchesGlob(relativePath, p))) {
      allFiles.delete(relativePath);
      excluded++;
    }
  }
  if (excluded > 0) console.log(`Excluded ${excluded} file(s) matching vault.exclude patterns\n`);
}

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

  const provider = await createStorageProvider(config);

  console.log(`Fetching vault from ${provider.name}...`);

  const allFiles = await provider.listFiles();
  console.log(`Found ${allFiles.size} files`);

  applyExcludePatterns(allFiles, config.vault.exclude ?? []);

  for (const [relativePath, file] of allFiles) {
    const targetPath = join(vaultCacheDir, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    const content = await provider.downloadFile(file.id);
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
      url: (outputPath) => `/vault/${outputPath}`,
    },
  });

  // Log how many MDX files fromVault() actually generated
  const mdxFiles = readdirSync(contentDir, { recursive: true }).filter(
    (f) => typeof f === 'string' && f.endsWith('.mdx')
  );
  console.log(`fromVault() generated ${mdxFiles.length} MDX files`);
  if (mdxFiles.length > 0) mdxFiles.slice(0, 5).forEach((f) => console.log(`  - ${f}`));

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
