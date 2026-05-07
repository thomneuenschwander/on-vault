import { google, drive_v3 } from 'googleapis';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  relativePath: string;
}

// Required for all Drive API calls to support Shared Drives
const SHARED_DRIVE_PARAMS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
} as const;

/**
 * Creates a Drive client using either:
 * - OAuth2 (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN) — for personal accounts
 * - Service Account (GOOGLE_SERVICE_ACCOUNT_JSON) — for Google Workspace Shared Drives
 *
 * OAuth2 is preferred when both are present.
 */
export function createDriveClient(): drive_v3.Drive {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  if (serviceAccountJson) {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
  }

  throw new Error(
    'No Google Drive credentials found.\n' +
    'For personal accounts: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and run: npm run auth\n' +
    'For Google Workspace: set GOOGLE_SERVICE_ACCOUNT_JSON'
  );
}

export async function listDriveFolder(
  drive: drive_v3.Drive,
  folderId: string,
  prefix: string,
  result: Map<string, DriveFile>
): Promise<void> {
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      pageSize: 1000,
      pageToken,
      ...SHARED_DRIVE_PARAMS,
    });

    for (const file of res.data.files ?? []) {
      const relativePath = prefix ? `${prefix}/${file.name}` : file.name!;

      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await listDriveFolder(drive, file.id!, relativePath, result);
      } else {
        result.set(relativePath, {
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          modifiedTime: file.modifiedTime!,
          relativePath,
        });
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
}

export async function getOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name = '${escaped}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    ...SHARED_DRIVE_PARAMS,
  });

  if (res.data.files?.length) return res.data.files[0].id!;

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    ...SHARED_DRIVE_PARAMS,
  });

  return folder.data.id!;
}

export async function ensureFolderPath(
  drive: drive_v3.Drive,
  relativeDirPath: string,
  rootFolderId: string,
  cache: Map<string, string>
): Promise<string> {
  if (!relativeDirPath || relativeDirPath === '.') return rootFolderId;
  if (cache.has(relativeDirPath)) return cache.get(relativeDirPath)!;

  const parts = relativeDirPath.split('/');
  let currentId = rootFolderId;
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    if (cache.has(currentPath)) {
      currentId = cache.get(currentPath)!;
    } else {
      currentId = await getOrCreateFolder(drive, part, currentId);
      cache.set(currentPath, currentId);
    }
  }

  return currentId;
}

export async function downloadFile(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: 'media', ...SHARED_DRIVE_PARAMS },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data as ArrayBuffer);
}
