import type { OnVaultConfig } from '../config';
import type { StorageProvider } from './interface';

export async function createStorageProvider(config: OnVaultConfig): Promise<StorageProvider> {
  const providerName = config.storage?.provider ?? 'google_drive';

  if (providerName === 's3') {
    const bucket = config.s3?.bucket ?? process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error(
        'S3 bucket not configured.\n' +
        'Set s3.bucket in on-vault.yaml or the S3_BUCKET environment variable.',
      );
    }
    const { createS3Provider } = await import('./s3');
    return createS3Provider({
      bucket,
      prefix: config.s3?.prefix ?? process.env.S3_PREFIX,
      region: config.s3?.region ?? process.env.AWS_REGION,
    });
  }

  // Default: Google Drive
  const folderId = config.google_drive?.folder_id ?? process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      'Google Drive folder ID not configured.\n' +
      'Set google_drive.folder_id in on-vault.yaml or the DRIVE_FOLDER_ID environment variable.',
    );
  }
  const { createGoogleDriveProvider } = await import('./google-drive');
  return createGoogleDriveProvider(folderId);
}

export type { StorageProvider, FileEntry } from './interface';
