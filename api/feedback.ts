// ============================================================
// Feedback & Bug Reports API
// Saves tester reports to Supabase database (with storage fallback)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: list recent feedbacks (admin view)
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        return res.status(200).json({ success: true, feedbacks: data });
      }

      // Fallback: read from storage bucket if table does not exist
      const bucket = process.env.SUPA_BUCKET || 'drive-clone-supa-1';
      const { data: storageList } = await supabaseAdmin.storage.from(bucket).list('feedback');
      
      const parsedFeedbacks: any[] = [];
      if (storageList && storageList.length > 0) {
        const recentFiles = [...storageList]
          .filter(f => f.name.endsWith('.json'))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 30);

        for (const file of recentFiles) {
          try {
            const { data: fileBlob } = await supabaseAdmin.storage
              .from(bucket)
              .download(`feedback/${file.name}`);
            if (fileBlob) {
              const text = await fileBlob.text();
              parsedFeedbacks.push(JSON.parse(text));
            }
          } catch {}
        }
      }

      return res.status(200).json({
        success: true,
        source: 'storage_fallback',
        feedbacks: parsedFeedbacks,
        storageFiles: storageList || [],
        notice: 'Database table not created yet. Run supabase/migrations/002_feedback.sql in Supabase SQL editor to view directly in Table Editor.',
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
