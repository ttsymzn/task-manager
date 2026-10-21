// Google Tasks 連携用の Supabase Edge Function
//
// Google のリフレッシュトークンをサーバー側 (public.google_tokens) に保管し、
// アプリからの要求に応じて短命のアクセストークンを発行する。
// client secret とリフレッシュトークンはブラウザに渡さない。
//
// リクエスト: POST { action: 'exchange', code } | { action: 'token' } | { action: 'disconnect' }
// 認証:       Authorization: Bearer <Supabase のユーザーアクセストークン>
//
// 必要なシークレット (supabase secrets set で設定):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で設定する。

import { createClient } from 'npm:@supabase/supabase-js@2';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function googleToken(params: Record<string, string>) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function exchange(userId: string, code: string) {
  // GIS のポップアップ方式 (initCodeClient, ux_mode: 'popup') では redirect_uri は 'postmessage'
  const { ok, data } = await googleToken({
    code,
    grant_type: 'authorization_code',
    redirect_uri: 'postmessage',
  });
  if (!ok) return json({ error: 'exchange_failed', detail: data.error_description || data.error }, 400);

  if (data.refresh_token) {
    const { error } = await admin.from('google_tokens').upsert({
      user_id: userId,
      refresh_token: data.refresh_token,
      scope: data.scope || null,
      updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: 'db_error', detail: error.message }, 500);
  } else {
    // 再同意なしで発行された場合はリフレッシュトークンが付かない。既存の保管分があればそれを使う。
    const { data: row } = await admin.from('google_tokens').select('user_id').eq('user_id', userId).maybeSingle();
    if (!row) return json({ error: 'no_refresh_token' }, 400);
  }
  return json({ access_token: data.access_token, expires_in: data.expires_in });
}

async function refresh(userId: string) {
  const { data: row, error } = await admin
    .from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (error) return json({ error: 'db_error', detail: error.message }, 500);
  if (!row) return json({ error: 'not_connected' }, 404);

  const { ok, data } = await googleToken({ refresh_token: row.refresh_token, grant_type: 'refresh_token' });
  if (!ok) {
    if (data.error === 'invalid_grant') {
      // ユーザーがGoogle側で権限を取り消した等。保管分を破棄して再接続を促す。
      await admin.from('google_tokens').delete().eq('user_id', userId);
      return json({ error: 'not_connected' }, 404);
    }
    return json({ error: 'refresh_failed', detail: data.error_description || data.error }, 502);
  }
  return json({ access_token: data.access_token, expires_in: data.expires_in });
}

async function disconnect(userId: string) {
  const { data: row } = await admin
    .from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (row) {
    await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: row.refresh_token }),
    }).catch(() => {});
    await admin.from('google_tokens').delete().eq('user_id', userId);
  }
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  switch (body.action) {
    case 'exchange':
      if (!body.code) return json({ error: 'missing_code' }, 400);
      return exchange(user.id, body.code);
    case 'token':
      return refresh(user.id);
    case 'disconnect':
      return disconnect(user.id);
    default:
      return json({ error: 'unknown_action' }, 400);
  }
});
