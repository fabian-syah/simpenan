// ============================================================
// Feedback & Bug Reports API
// Saves tester reports to Supabase database (with storage fallback)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase.js';

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderDashboardHtml(feedbacks: any[], source: string): string {
  const total = feedbacks.length;

  const feedbackRows = feedbacks
    .map((f, idx) => {
      const createdDate = f.created_at ? new Date(f.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
      const meta = f.metadata || {};
      const screenInfo = meta.screen ? escapeHtml(meta.screen) : '-';
      const platformInfo = meta.platform ? escapeHtml(meta.platform) : '-';
      const userAgentInfo = escapeHtml(f.user_agent || meta.userAgent || '-');
      const contactVal = f.contact ? escapeHtml(f.contact) : '-';
      const hasEmail = f.contact && f.contact.includes('@');

      return `
        <tr class="feedback-row" data-category="${escapeHtml(f.category || 'general')}">
          <td class="col-num">${idx + 1}</td>
          <td class="col-date">${escapeHtml(createdDate)}</td>
          <td class="col-cat">
            <span class="badge badge-${escapeHtml(f.category || 'general')}">${escapeHtml(f.category || 'general')}</span>
          </td>
          <td class="col-message">
            <div class="message-text">${escapeHtml(f.message || '')}</div>
            ${f.file_name ? `<div class="file-tag">File terkait: ${escapeHtml(f.file_name)}</div>` : ''}
          </td>
          <td class="col-contact">
            ${hasEmail ? `<a href="mailto:${contactVal}?subject=Tanggapan Feedback Simpenan" class="contact-link">${contactVal}</a>` : `<span>${contactVal}</span>`}
          </td>
          <td class="col-meta">
            <details class="meta-details">
              <summary>Detail Teknis</summary>
              <div class="meta-box">
                <div><strong>Layar:</strong> ${screenInfo}</div>
                <div><strong>OS:</strong> ${platformInfo}</div>
                <div><strong>Path:</strong> ${escapeHtml(f.page_path || '/')}</div>
                <div class="ua-text"><strong>User-Agent:</strong> ${userAgentInfo}</div>
              </div>
            </details>
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simpenan - Pusat Laporan dan Feedback</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #070b14;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 24px;
    }
    .brand-title { font-size: 22px; font-weight: 700; color: #38bdf8; }
    .brand-subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .header-actions { display: flex; gap: 10px; align-items: center; }
    .btn {
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }
    .btn-primary { background-color: #0284c7; color: #ffffff; }
    .btn-primary:hover { background-color: #0369a1; }
    .btn-outline { background-color: #0f172a; border-color: #334155; color: #cbd5e1; }
    .btn-outline:hover { background-color: #1e293b; color: #ffffff; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 16px;
    }
    .stat-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 6px;
    }
    .stat-value { font-size: 26px; font-weight: 700; color: #f8fafc; }
    .stat-desc { font-size: 12px; color: #0ea5e9; margin-top: 4px; }
    .controls-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 16px;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      padding: 12px 16px;
      border-radius: 10px;
    }
    .search-input {
      flex: 1;
      min-width: 220px;
      background-color: #070b14;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
    }
    .search-input:focus { outline: none; border-color: #0ea5e9; }
    .filter-select {
      background-color: #070b14;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
    }
    .table-container {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th {
      background-color: #1e293b;
      color: #94a3b8;
      font-weight: 600;
      padding: 12px 14px;
      border-bottom: 1px solid #334155;
      white-space: nowrap;
    }
    td { padding: 14px; border-bottom: 1px solid #1e293b; vertical-align: top; }
    tr:hover td { background-color: #131e32; }
    .col-num { width: 40px; color: #64748b; }
    .col-date { width: 140px; color: #94a3b8; white-space: nowrap; }
    .col-cat { width: 130px; }
    .col-contact { width: 180px; word-break: break-all; }
    .col-meta { width: 140px; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      background-color: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }
    .badge-quota { background-color: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
    .badge-playback { background-color: rgba(168, 85, 247, 0.15); color: #c084fc; border-color: rgba(168, 85, 247, 0.3); }
    .badge-upload { background-color: rgba(234, 179, 8, 0.15); color: #facc15; border-color: rgba(234, 179, 8, 0.3); }
    .badge-feature { background-color: rgba(34, 197, 94, 0.15); color: #4ade80; border-color: rgba(34, 197, 94, 0.3); }
    .badge-general { background-color: rgba(14, 165, 233, 0.15); color: #38bdf8; border-color: rgba(14, 165, 233, 0.3); }
    .message-text { color: #f1f5f9; white-space: pre-wrap; word-break: break-word; font-size: 13px; }
    .file-tag {
      margin-top: 6px;
      font-size: 11px;
      color: #38bdf8;
      background: rgba(14, 165, 233, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .contact-link { color: #38bdf8; text-decoration: none; }
    .contact-link:hover { text-decoration: underline; }
    .meta-details summary { cursor: pointer; color: #94a3b8; font-size: 11px; user-select: none; }
    .meta-box {
      margin-top: 6px;
      background-color: #070b14;
      border: 1px solid #334155;
      padding: 8px;
      border-radius: 6px;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.4;
    }
    .ua-text { word-break: break-all; font-size: 10px; margin-top: 4px; color: #64748b; }
    .empty-state { padding: 48px 16px; text-align: center; color: #64748b; font-size: 14px; }
    footer { margin-top: 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="brand-title">Simpenan Cloud Feedback Center</div>
        <div class="brand-subtitle">Pusat monitoring masukan, kendala teknis, dan saran dari beta tester</div>
      </div>
      <div class="header-actions">
        <a href="/" class="btn btn-outline">Buka Simpenan Drive</a>
        <a href="/api/feedback?format=json" target="_blank" class="btn btn-outline">Raw JSON</a>
        <button onclick="location.reload()" class="btn btn-primary">Refresh Data</button>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">Total Laporan Masuk</div>
        <div class="stat-value">${total}</div>
        <div class="stat-desc">Semua feedback dari tester</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Penyimpanan Database</div>
        <div class="stat-value" style="font-size: 18px; text-transform: capitalize;">${escapeHtml(source.replace('_', ' '))}</div>
        <div class="stat-desc">Terkoneksi ke Supabase</div>
      </div>
    </div>

    <div class="controls-bar">
      <input type="text" id="searchInput" class="search-input" placeholder="Cari isi pesan atau email tester...">
      <select id="categoryFilter" class="filter-select">
        <option value="all">Semua Kategori</option>
        <option value="quota">Kuota / Limit</option>
        <option value="playback">Video / Audio</option>
        <option value="upload">Upload / Unduh</option>
        <option value="feature">Saran & Ide Fitur</option>
        <option value="general">Pertanyaan / Umum</option>
      </select>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th class="col-num">No</th>
            <th class="col-date">Waktu Lapor</th>
            <th class="col-cat">Kategori</th>
            <th class="col-message">Isi Masukan / Kendala</th>
            <th class="col-contact">Kontak Tester</th>
            <th class="col-meta">Info Teknis</th>
          </tr>
        </thead>
        <tbody id="feedbackTableBody">
          ${total > 0 ? feedbackRows : '<tr><td colspan="6" class="empty-state">Belum ada feedback yang masuk.</td></tr>'}
        </tbody>
      </table>
    </div>

    <footer>
      Simpenan Cloud Storage Beta Monitoring Dashboard
    </footer>
  </div>

  <script>
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const rows = document.querySelectorAll('.feedback-row');

    function applyFilters() {
      const q = (searchInput.value || '').toLowerCase().trim();
      const cat = categoryFilter.value;

      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const rowCat = row.getAttribute('data-category') || 'general';
        const matchesQuery = !q || text.includes(q);
        const matchesCat = (cat === 'all') || (rowCat === cat);

        if (matchesQuery && matchesCat) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    searchInput.addEventListener('input', applyFilters);
    categoryFilter.addEventListener('change', applyFilters);
  </script>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: list recent feedbacks (admin view / web dashboard)
  if (req.method === 'GET') {
    try {
      let feedbacks: any[] = [];
      let source = 'database';

      const { data, error } = await supabaseAdmin
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        feedbacks = data;

        // If table exists but is empty, check if we need to auto-sync existing storage fallback files
        if (feedbacks.length === 0) {
          const bucket = process.env.SUPA_BUCKET || 'drive-clone-supa-1';
          const { data: storageList } = await supabaseAdmin.storage.from(bucket).list('feedback');
          if (storageList && storageList.length > 0) {
            for (const file of storageList) {
              if (!file.name.endsWith('.json')) continue;
              try {
                const { data: fileBlob } = await supabaseAdmin.storage
                  .from(bucket)
                  .download(`feedback/${file.name}`);
                if (fileBlob) {
                  const item = JSON.parse(await fileBlob.text());
                  await supabaseAdmin.from('feedback').insert({
                    category: item.category || 'general',
                    message: item.message,
                    contact: item.contact || null,
                    file_id: item.file_id || null,
                    file_name: item.file_name || null,
                    page_path: item.page_path || '/',
                    user_agent: item.user_agent || null,
                    metadata: item.metadata || {},
                    status: item.status || 'new',
                    created_at: item.created_at || new Date().toISOString(),
                  });
                }
              } catch {}
            }

            const { data: refetched } = await supabaseAdmin
              .from('feedback')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);
            if (refetched && refetched.length > 0) {
              feedbacks = refetched;
            }
          }
        }
      } else {
        source = 'storage_fallback';
        const bucket = process.env.SUPA_BUCKET || 'drive-clone-supa-1';
        const { data: storageList } = await supabaseAdmin.storage.from(bucket).list('feedback');
        if (storageList && storageList.length > 0) {
          const recentFiles = [...storageList]
            .filter((f) => f.name.endsWith('.json'))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 50);

          for (const file of recentFiles) {
            try {
              const { data: fileBlob } = await supabaseAdmin.storage
                .from(bucket)
                .download(`feedback/${file.name}`);
              if (fileBlob) {
                const text = await fileBlob.text();
                feedbacks.push(JSON.parse(text));
              }
            } catch {}
          }
        }
      }

      const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      const wantsJson = req.query.format === 'json';

      if (acceptsHtml && !wantsJson) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(renderDashboardHtml(feedbacks, source));
      }

      return res.status(200).json({
        success: true,
        source,
        feedbacks,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch feedback' });
    }
  }

  // POST: submit new feedback
  if (req.method === 'POST') {
    const {
      category = 'general',
      message,
      contact,
      fileId,
      fileName,
      pagePath = '/',
      userAgent,
      metadata = {},
    } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Pesan feedback tidak boleh kosong.' });
    }

    const payload = {
      category: String(category).slice(0, 50),
      message: message.trim(),
      contact: contact ? String(contact).trim().slice(0, 150) : null,
      file_id: fileId || null,
      file_name: fileName || null,
      page_path: String(pagePath).slice(0, 500),
      user_agent: userAgent ? String(userAgent).slice(0, 500) : (req.headers['user-agent'] || null),
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
      status: 'new',
    };

    // Strategy 1: Insert into 'feedback' Supabase table
    try {
      const { data, error } = await supabaseAdmin
        .from('feedback')
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        return res.status(200).json({
          success: true,
          id: data.id,
          message: 'Terima kasih! Feedback berhasil disimpan di database.',
        });
      }

      console.warn('Feedback table insert failed, falling back to storage:', error?.message);
    } catch (tableErr: any) {
      console.warn('Feedback table exception:', tableErr?.message);
    }

    // Strategy 2: Fallback to Supabase Storage file
    try {
      const bucket = process.env.SUPA_BUCKET || 'drive-clone-supa-1';
      const storageKey = `feedback/feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`;
      const record = {
        ...payload,
        created_at: new Date().toISOString(),
      };

      const { error: uploadErr } = await supabaseAdmin.storage
        .from(bucket)
        .upload(storageKey, JSON.stringify(record, null, 2), {
          contentType: 'application/json',
          upsert: true,
        });

      if (!uploadErr) {
        return res.status(200).json({
          success: true,
          storageKey,
          message: 'Terima kasih! Feedback berhasil dicatat dan disimpan.',
        });
      }

      console.error('Storage feedback upload error:', uploadErr);
    } catch (storageErr: any) {
      console.error('Storage fallback error:', storageErr);
    }

    return res.status(500).json({ error: 'Gagal mencatat feedback. Silakan coba lagi.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
