import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageProvider, FileEntry } from './interface';

export interface S3Config {
  bucket: string;
  prefix?: string;
  region?: string;
}

export function createS3Provider(config: S3Config): StorageProvider {
  const { bucket, region } = config;
  const prefix = config.prefix
    ? config.prefix.endsWith('/') ? config.prefix : `${config.prefix}/`
    : '';

  const client = new S3Client({ region: region ?? process.env.AWS_REGION });

  function toKey(relativePath: string): string {
    return prefix + relativePath;
  }

  function fromKey(key: string): string {
    return prefix ? key.slice(prefix.length) : key;
  }

  return {
    name: 'S3',

    async listFiles(): Promise<Map<string, FileEntry>> {
      const result = new Map<string, FileEntry>();
      let continuationToken: string | undefined;

      do {
        const res = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix || undefined,
          ContinuationToken: continuationToken,
        }));

        for (const obj of res.Contents ?? []) {
          if (!obj.Key || obj.Key.endsWith('/')) continue;
          result.set(fromKey(obj.Key), {
            id: obj.Key,
            mtime: obj.LastModified ?? new Date(0),
          });
        }

        continuationToken = res.NextContinuationToken;
      } while (continuationToken);

      return result;
    },

    async downloadFile(id: string): Promise<Buffer> {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: id }));
      const chunks: Uint8Array[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    },

    async uploadFile(
      relativePath: string,
      content: Buffer,
      _mtime: Date,
      mimeType: string,
      _existingId: string | null,
    ): Promise<void> {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: toKey(relativePath),
        Body: content,
        ContentType: mimeType,
      }));
    },

    async deleteFile(id: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: id }));
    },
  };
}
