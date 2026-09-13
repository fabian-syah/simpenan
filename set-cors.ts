import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
}

async function setupCors() {
  console.log('Setting up CORS for Backblaze B2...');
  
  if (!process.env.B2_KEY_ID || !process.env.B2_APP_KEY) {
    console.error('Missing B2 credentials in .env');
    return;
  }

  const b2Client = new S3Client({
    endpoint: process.env.B2_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com',
    region: process.env.B2_REGION || 'us-west-004',
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APP_KEY,
    },
    forcePathStyle: true,
  });

  const b2Bucket = process.env.B2_BUCKET || 'drive-clone-b2';

  const corsRule = {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedOrigins: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000,
      },
    ],
  };

  try {
    const command = new PutBucketCorsCommand({
      Bucket: b2Bucket,
      CORSConfiguration: corsRule,
    });
    
    await b2Client.send(command);
    console.log(`[SUCCESS] Successfully applied CORS rules to Backblaze bucket: ${b2Bucket}`);
  } catch (err) {
    console.error('[ERROR] Failed to set Backblaze CORS:', err);
  }

  // Filebase CORS
  console.log('\nSetting up CORS for Filebase...');
  if (process.env.FILEBASE_KEY && process.env.FILEBASE_SECRET) {
    const fbClient = new S3Client({
      endpoint: process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.io',
      region: process.env.FILEBASE_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.FILEBASE_KEY,
        secretAccessKey: process.env.FILEBASE_SECRET,
      },
      forcePathStyle: true,
    });

    const fbBucket = process.env.FILEBASE_BUCKET || 'drive-clone-filebase-1';

    try {
      const fbCommand = new PutBucketCorsCommand({
        Bucket: fbBucket,
        CORSConfiguration: corsRule,
      });
      await fbClient.send(fbCommand);
      console.log(`[SUCCESS] Successfully applied CORS rules to Filebase bucket: ${fbBucket}`);
    } catch (err) {
      console.error('[ERROR] Failed to set Filebase CORS:', err);
    }
  }
}

setupCors();
