import { load } from 'js-yaml';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface OnVaultConfig {
  site: {
    title: string;
    base_path: string;
  };
  vault: {
    path: string;
    sync_config?: boolean;
  };
  google_drive: {
    folder_id: string;
  };
}

const CONFIG_FILE = 'on-vault.yaml';

export function loadConfig(): OnVaultConfig {
  const configPath = join(process.cwd(), CONFIG_FILE);
  if (existsSync(configPath)) {
    return load(readFileSync(configPath, 'utf-8')) as OnVaultConfig;
  }

  // Fallback to environment variables (CI/CD, Vercel)
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      `${CONFIG_FILE} not found and DRIVE_FOLDER_ID env var is not set.\n` +
      `Either copy on-vault.yaml.example to on-vault.yaml, ` +
      `or set DRIVE_FOLDER_ID (and optionally NEXT_PUBLIC_BASE_PATH, NEXT_PUBLIC_SITE_TITLE) as environment variables.`
    );
  }

  return {
    site: {
      title: process.env.NEXT_PUBLIC_SITE_TITLE ?? 'on-vault',
      base_path: process.env.NEXT_PUBLIC_BASE_PATH ?? 'docs',
    },
    vault: {
      path: process.env.VAULT_PATH ?? '~/Documents/Vault',
    },
    google_drive: {
      folder_id: folderId,
    },
  };
}

export function getBasePath(): string {
  // Env var takes priority (set explicitly in CI/CD or next.config.mjs)
  if (process.env.NEXT_PUBLIC_BASE_PATH) return process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    return loadConfig().site?.base_path ?? 'docs';
  } catch {
    return 'docs';
  }
}
