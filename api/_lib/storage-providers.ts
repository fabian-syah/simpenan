// ============================================================
// Multi-Cloud Storage Provider Factory
// Creates S3-compatible clients for Backblaze B2 and Filebase
// ============================================================
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type ProviderId = 'backblaze' | 'filebase' | 'supabase';

interface ProviderConfig {
  client: S3Client;
  bucket: string;
}

// Build S3 clients from environment variables
function createProviderClients(): Map<string, ProviderConfig> {
  const providers = new Map<string, ProviderConfig>();

  // Backblaze B2
  if (process.env.B2_KEY_ID && process.env.B2_APP_KEY) {
    providers.set('backblaze', {
      client: new S3Client({
        endpoint: process.env.B2_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com',
        region: process.env.B2_REGION || 'us-west-004',
        credentials: {
          accessKeyId: process.env.B2_KEY_ID,
          secretAccessKey: process.env.B2_APP_KEY,
        },
        forcePathStyle: true,
      }),
      bucket: process.env.B2_BUCKET || 'drive-clone-b2',
    });
  }

  // Filebase
  if (process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET) {
    providers.set('filebase', {
      client: new S3Client({
        endpoint: process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.io',
        region: process.env.FILEBASE_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.FILEBASE_KEY,
          secretAccessKey: process.env.FILEBASE_SECRET,
        },
        forcePathStyle: true,
      }),
      bucket: process.env.FILEBASE_BUCKET || 'drive-clone-filebase-1',
    });
  }

  return providers;
}

let _clients: Map<string, ProviderConfig> | null = null;

function getClients(): Map<string, ProviderConfig> {
  if (!_clients) {
    _clients = createProviderClients();
  }
  return _clients;
}

export function getProviderClient(providerId: string): ProviderConfig | null {
  return getClients().get(providerId) || null;
}

// ============================================================
// Presigned URL generation
// ============================================================

/** Generate a presigned PUT URL for single-part upload */
export async function getPresignedUploadUrl(
  providerId: string,
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const provider = getProviderClient(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not configured`);

  const command = new PutObjectCommand({
    Bucket: provider.bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(provider.client, command, { expiresIn });
}

/** Generate a presigned GET URL for download */
export async function getPresignedDownloadUrl(
  providerId: string,
  key: string,
  expiresIn = 3600
): Promise<string> {
  const provider = getProviderClient(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not configured`);

  const command = new GetObjectCommand({
    Bucket: provider.bucket,
    Key: key,
  });

  return getSignedUrl(provider.client, command, { expiresIn });
}

// ============================================================
// Multipart upload helpers
// ============================================================

/** Initiate a multipart upload and return the uploadId */
export async function initiateMultipartUpload(
  providerId: string,
  key: string,
  contentType: string
): Promise<string> {
  const provider = getProviderClient(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not configured`);

  const command = new CreateMultipartUploadCommand({
    Bucket: provider.bucket,
    Key: key,
    ContentType: contentType,
  });

  const response = await provider.client.send(command);
  if (!response.UploadId) throw new Error('Failed to initiate multipart upload');
  return response.UploadId;
}

/** Generate presigned URLs for each part of a multipart upload */
export async function getMultipartPresignedUrls(
  providerId: string,
  key: string,
  uploadId: string,
  partCount: number,
  expiresIn = 3600
): Promise<string[]> {
  const provider = getProviderClient(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not configured`);

  const urls: string[] = [];
  for (let i = 1; i <= partCount; i++) {
    const command = new UploadPartCommand({
      Bucket: provider.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: i,
    });
    const url = await getSignedUrl(provider.client, command, { expiresIn });
    urls.push(url);
  }
  return urls;
}

/** Complete a multipart upload */
export async function completeMultipartUpload(
  providerId: string,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<void> {
  const provider = getProviderClient(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not configured`);

  const command = new CompleteMultipartUploadCommand({
    Bucket: provider.bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag,
      })),
    },
  });

  await provider.client.send(command);
}

/** Abort a multipart upload */
export async function abortMultipartUpload(
  providerId: string,
  key: string,
  uploadId: string
): Promise<void> {
  const provider = getProviderClient(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not configured`);

  const command = new AbortMultipartUploadCommand({
    Bucket: provider.bucket,
    Key: key,
    UploadId: uploadId,
  });

  await provider.client.send(command);
}

/** Delete an object from storage */
export async function deleteObject(
  providerId: string,
  key: string
): Promise<void> {
  const provider = getProviderClient(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not configured`);

  const command = new DeleteObjectCommand({
    Bucket: provider.bucket,
    Key: key,
  });

  await provider.client.send(command);
}
