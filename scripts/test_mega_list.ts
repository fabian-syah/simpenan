import { getMegaStorage } from '../api/_lib/mega.js';

async function main() {
  const storage = await getMegaStorage();
  console.log('Total files in MEGA:', Object.keys(storage.files).length);
  for (const id of Object.keys(storage.files)) {
    const f: any = storage.files[id];
    if (f && !f.directory) {
      console.log(`- ${f.name} (${f.size} bytes), nodeId: ${f.nodeId}`);
    }
  }
  process.exit(0);
}
main().catch(console.error);
