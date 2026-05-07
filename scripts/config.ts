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
  if (!existsSync(configPath)) {
    throw new Error(
      `${CONFIG_FILE} not found. Copy on-vault.yaml.example to on-vault.yaml and fill in your values.`
    );
  }
  return load(readFileSync(configPath, 'utf-8')) as OnVaultConfig;
}

export function getBasePath(): string {
  try {
    return loadConfig().site?.base_path ?? 'docs';
  } catch {
    return 'docs';
  }
}
