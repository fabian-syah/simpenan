import { getMegaStorage } from '../api/_lib/mega.js';
import { Readable } from 'node:stream';

async function main() {
  console.log('Testing 10MB upload to MEGA with progress and error listeners...');
  const size = 10 * 1024 * 1024;
  const buffer = Buffer.alloc(size, 65);
  const stream = Readable.from(buffer);

  const storage = await getMegaStorage();
  const uploadStream: any = storage.upload({
    name: 'test-10mb.bin',
    size,
  });

  uploadStream.on('progress', (info: any) => {
    console.log('Upload progress:', info);
  });

  uploadStream.on('error', (err: any) => {
    console.error('Upload stream error event:', err);
  });

  stream.pipe(uploadStream);

  const file = await uploadStream.complete;
  console.log('Upload finished! Node ID:', file.nodeId);
  const link = await file.link();
  console.log('Link:', link);

  // cleanup test file
  await file.delete(true);
  console.log('Deleted test file.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Main error:', err);
  process.exit(1);
});
