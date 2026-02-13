import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PushRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@example.com';
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const reminderHour = Number(Deno.env.get('REMINDER_HOUR_UTC') ?? 18);

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    return json(500, { error: 'Missing required environment variables.' });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

  let payload: { force?: boolean; userId?: string; title?: string; body?: string; url?: string } = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const force = Boolean(payload.force);
  const suppliedUserId = payload.userId;

  const authHeader = req.headers.get('Authorization') ?? '';
  const cronHeader = req.headers.get('x-cron-secret') ?? '';
  const isCronCall = cronSecret.length > 0 && cronHeader === cronSecret;

  let authenticatedUserId: string | null = null;
  if (authHeader) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    authenticatedUserId = user?.id ?? null;
  }

  if (!isCronCall && !authenticatedUserId) {
    return json(401, { error: 'Unauthorized. Provide a valid JWT or cron secret.' });
  }

  const currentUtcHour = new Date().getUTCHours();
  if (!force && !isCronCall && currentUtcHour !== reminderHour) {
    return json(200, {
      sent: 0,
      skipped: true,
      reason: `Current UTC hour ${currentUtcHour} does not match REMINDER_HOUR_UTC ${reminderHour}.`,
    });
  }

  const targetUserId = authenticatedUserId ?? suppliedUserId ?? null;

  let query = admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh_key, auth_key')
    .eq('is_active', true);

  if (targetUserId) {
    query = query.eq('user_id', targetUserId);
  }

  const { data: subscriptions, error: fetchError } = await query;
  if (fetchError) {
    return json(500, { error: fetchError.message });
  }

  const rows = (subscriptions as PushRow[]) ?? [];
  if (rows.length === 0) {
    return json(200, { sent: 0, skipped: false, reason: 'No active subscriptions found.' });
  }

  const title = payload.title ?? 'Mandarin reminder';
  const body = payload.body ?? 'Time for a quick review session.';
  const url = payload.url ?? '/study';
  const notificationPayload = JSON.stringify({ title, body, url });

  let sent = 0;
  const deactivateIds: number[] = [];

  for (const row of rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh_key,
        auth: row.auth_key,
      },
    };

    try {
      await webpush.sendNotification(subscription, notificationPayload, {
        TTL: 60,
      });
      sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        deactivateIds.push(row.id);
      }
    }
  }

  if (deactivateIds.length > 0) {
    await admin
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', deactivateIds);
  }

  return json(200, {
    sent,
    attempted: rows.length,
    deactivated: deactivateIds.length,
    scheduledHourUtc: reminderHour,
    currentUtcHour,
  });
});
