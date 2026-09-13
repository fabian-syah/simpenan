// ============================================================
// /api/payment
// Paywuz.id payment gateway integration for Simpenan Cloud MVP
// Actions:
// - POST ?action=create : Create payment transaction via Paywuz
// - POST ?action=webhook: Receive payment confirmation from Paywuz
// - GET  ?action=status : Check order status
// - GET  ?action=history: List user payment history
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, getAuthUser } from './_lib/supabase.js';

interface TierPricing {
  amount: number;
  storageLimitBytes: number;
  maxFileSizeBytes: number;
  isLifetime: boolean;
  name: string;
}

const TIER_CONFIG: Record<string, Record<string, TierPricing>> = {
  founder: {
    lifetime: {
      amount: 99000,
      storageLimitBytes: 53687091200,   // 50 GB
      maxFileSizeBytes: 5368709120,     // 5 GB
      isLifetime: true,
      name: "Founder's Edition (Lifetime 50 GB)",
    },
  },
  pro: {
    monthly: {
      amount: 15000,
      storageLimitBytes: 53687091200,   // 50 GB
      maxFileSizeBytes: 5368709120,     // 5 GB
      isLifetime: false,
      name: 'Pro Bulanan (50 GB)',
    },
    yearly: {
      amount: 150000,
      storageLimitBytes: 53687091200,   // 50 GB
      maxFileSizeBytes: 5368709120,     // 5 GB
      isLifetime: false,
      name: 'Pro Tahunan (50 GB)',
    },
  },
  creator: {
    monthly: {
      amount: 45000,
      storageLimitBytes: 214748364800,  // 200 GB
      maxFileSizeBytes: 21474836480,    // 20 GB
      isLifetime: false,
      name: 'Creator Bulanan (200 GB)',
    },
    yearly: {
      amount: 450000,
      storageLimitBytes: 214748364800,  // 200 GB
      maxFileSizeBytes: 21474836480,    // 20 GB
      isLifetime: false,
      name: 'Creator Tahunan (200 GB)',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = (req.query.action as string) || 'create';

  // 0. AUTO-CONFIRM: Immediately confirm email for instant registration
  if (action === 'auto-confirm' && req.method === 'POST') {
    try {
      const { userId, email } = req.body || {};
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });
        return res.status(200).json({ ok: true, confirmed: true });
      }
      if (email) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const found = users?.find((u: any) => u.email === email.trim());
        if (found) {
          await supabaseAdmin.auth.admin.updateUserById(found.id, { email_confirm: true });
          return res.status(200).json({ ok: true, confirmed: true });
        }
      }
      return res.status(400).json({ error: 'userId or email is required' });
    } catch (err: any) {
      console.error('Auto-confirm error:', err);
      return res.status(500).json({ error: err.message || 'Auto-confirm failed' });
    }
  }

  // 1. WEBHOOK: Receive callback from Paywuz.id
  if (action === 'webhook' && req.method === 'POST') {
    try {
      const payload = req.body || {};
      const { orderId, status, transactionId } = payload;

      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      // Query payment record
      const { data: paymentRecord, error: pErr } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (pErr || !paymentRecord) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const isPaid = status === 'PAID' || status === 'SUCCESS' || status === 'COMPLETED';
      if (isPaid) {
        // Upgrade user profile
        const tier = paymentRecord.tier;
        const period = paymentRecord.payload?.period || 'lifetime';
        const tierInfo = TIER_CONFIG[tier]?.[period] || TIER_CONFIG.founder.lifetime;

        let subEndDate: string | null = null;
        if (!tierInfo.isLifetime) {
          const now = new Date();
          if (period === 'yearly') {
            now.setFullYear(now.getFullYear() + 1);
          } else {
            now.setMonth(now.getMonth() + 1);
          }
          subEndDate = now.toISOString();
        }

        // Update profiles table
        await supabaseAdmin
          .from('profiles')
          .update({
            tier,
            is_lifetime: tierInfo.isLifetime,
            storage_limit_bytes: tierInfo.storageLimitBytes,
            max_file_size_bytes: tierInfo.maxFileSizeBytes,
            subscription_end_date: subEndDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentRecord.user_id);

        // Update payments table
        await supabaseAdmin
          .from('payments')
          .update({
            status: 'PAID',
            paywuz_tx_id: transactionId || paymentRecord.paywuz_tx_id,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);
      }

      return res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (err: any) {
      console.error('Webhook error:', err);
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // User authentication required for other actions
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized: Silakan login terlebih dahulu.' });
  }

  // 2. CREATE TRANSACTION: Request to Paywuz API
  if (action === 'create' && req.method === 'POST') {
    try {
      const { tier = 'founder', period = 'lifetime', paymentMethod = 'ALL' } = req.body || {};

      const tierGroup = TIER_CONFIG[tier];
      if (!tierGroup) {
        return res.status(400).json({ error: `Tier '${tier}' tidak valid.` });
      }

      const planConfig = tierGroup[period] || tierGroup[Object.keys(tierGroup)[0]];
      if (!planConfig) {
        return res.status(400).json({ error: `Paket '${tier} (${period})' tidak valid.` });
      }

      const orderId = `SIMP-${authUser.id.slice(0, 8)}-${Date.now()}`;
      const paywuzApiKey = process.env.PAYWUZ_API_KEY?.trim();

      let paywuzResponse: any = null;
      let paymentUrl = '';
      let qrString = '';
      let vaNumber = '';
      let vaBank = '';

      if (paywuzApiKey) {
        try {
          const apiRes = await fetch('https://api.paywuz.id/v1/transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${paywuzApiKey}`,
            },
            body: JSON.stringify({
              orderId,
              amount: planConfig.amount,
              paymentMethod: paymentMethod || 'ALL',
              expiryMinutes: 60,
            }),
          });

          if (apiRes.ok) {
            paywuzResponse = await apiRes.json();
            paymentUrl = paywuzResponse.paymentUrl || paywuzResponse.redirectUrl || '';
            qrString = paywuzResponse.qrString || '';
            vaNumber = paywuzResponse.vaNumber || '';
            vaBank = paywuzResponse.bank || '';
          } else {
            const errText = await apiRes.text();
            console.warn('Paywuz API response not ok:', apiRes.status, errText);
          }
        } catch (paywuzErr: any) {
          console.warn('Paywuz API fetch error:', paywuzErr.message);
        }
      }

      // Record transaction in Supabase payments table
      await supabaseAdmin.from('payments').insert({
        user_id: authUser.id,
        order_id: orderId,
        tier,
        amount: planConfig.amount,
        payment_method: paymentMethod,
        status: 'PENDING',
        paywuz_tx_id: paywuzResponse?.id || null,
        payment_url: paymentUrl,
        qr_string: qrString,
        va_number: vaNumber,
        va_bank: vaBank,
        payload: {
          period,
          planName: planConfig.name,
          paywuzResponse,
        },
      });

      return res.status(200).json({
        success: true,
        orderId,
        amount: planConfig.amount,
        planName: planConfig.name,
        paymentUrl: paymentUrl || `https://paywuz.id`,
        qrString,
        vaNumber,
        vaBank,
        expiryMinutes: 60,
      });
    } catch (err: any) {
      console.error('Create transaction error:', err);
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // 3. STATUS: Check payment status
  if (action === 'status' && req.method === 'GET') {
    try {
      const orderId = req.query.orderId as string;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .eq('user_id', authUser.id)
        .single();

      if (error || !payment) {
        return res.status(404).json({ error: 'Order not found' });
      }

      return res.status(200).json({
        success: true,
        orderId: payment.order_id,
        status: payment.status,
        amount: payment.amount,
        tier: payment.tier,
        paidAt: payment.paid_at,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  // 4. HISTORY: List user transactions
  if (action === 'history' && req.method === 'GET') {
    try {
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('id, order_id, tier, amount, status, paid_at, created_at')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch history' });
      }

      return res.status(200).json({ success: true, payments: payments || [] });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
