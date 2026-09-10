import { supabaseAdmin } from '../api/_lib/supabase.js';
import { getMediaFireAccountQuota } from '../api/_lib/mediafire.js';

async function check() {
  const { data, error } = await supabaseAdmin
    .from('files')
    .select('id, name, parent_path, size_bytes, upload_status')
    .like('parent_path', '.variants%');
  console.log('Variants found in DB:', JSON.stringify(data, null, 2));
  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
