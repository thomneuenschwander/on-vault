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
    exclude?: string[];
  };
  storage?: {
    provider?: 'google_drive' | 's3';
    /** Set false to prevent vault→storage uploads. Fetch still works. Default: true */
    sync_enabled?: boolean;
  };
  google_drive?: {
    folder_id: string;
  };
  s3?: {
    bucket: string;
    prefix?: string;
    region?: string;
  };
}

const CONFIG_FILE = 'on-vault.yaml';

export function loadConfig(): OnVaultConfig {
  const configPath = join(process.cwd(), CONFIG_FILE);
  if (existsSync(configPath)) {
    return load(readFileSync(configPath, 'utf-8')) as OnVaultConfig;
  }

  // Fallback to environment variables (CI/CD, Vercel)
  const provider = (process.env.STORAGE_PROVIDER ?? 'google_drive') as 'google_drive' | 's3';
  const folderId = process.env.DRIVE_FOLDER_ID;
  const s3Bucket = process.env.S3_BUCKET;

  if (provider === 's3' && !s3Bucket) {
    throw new Error(
      `${CONFIG_FILE} not found and S3_BUCKET env var is not set.\n` +
      `Either copy on-vault.yaml.example to on-vault.yaml, ` +
      `or set S3_BUCKET (and optionally S3_PREFIX, AWS_REGION) as environment variables.`,
    );
  }
  if (provider === 'google_drive' && !folderId) {
    throw new Error(
      `${CONFIG_FILE} not found and DRIVE_FOLDER_ID env var is not set.\n` +
      `Either copy on-vault.yaml.example to on-vault.yaml, ` +
      `or set DRIVE_FOLDER_ID (and optionally NEXT_PUBLIC_BASE_PATH, NEXT_PUBLIC_SITE_TITLE) as environment variables.`,
    );
  }

  return {
    site: {
      title: process.env.NEXT_PUBLIC_SITE_TITLE ?? 'on-vault',
      base_path: process.env.NEXT_PUBLIC_BASE_PATH ?? 'docs',
    },
    vault: {
      path: process.env.VAULT_PATH ?? '~/Documents/Vault',
      exclude: process.env.VAULT_EXCLUDE?.split(',').map((s) => s.trim()).filter(Boolean),
    },
    storage: {
      provider,
      sync_enabled: process.env.STORAGE_SYNC_ENABLED !== 'false',
    },
    google_drive: folderId ? { folder_id: folderId } : undefined,
    s3: s3Bucket
      ? { bucket: s3Bucket, prefix: process.env.S3_PREFIX, region: process.env.AWS_REGION }
      : undefined,
  };
}

export function getBasePath(): string {
  if (process.env.NEXT_PUBLIC_BASE_PATH) return process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    return loadConfig().site?.base_path ?? 'docs';
  } catch {
    return 'docs';
  }
}
