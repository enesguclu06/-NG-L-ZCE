import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const STORAGE_KEY = 'yokdilhunter_session';

async function getHeaders(requireAuth = false) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    const session = await getSession();
    if (!session || !session.access_token) {
      throw new Error('Not authenticated');
    }
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

export async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: await getHeaders(false),
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Giriş başarısız');

  data.created_at = Math.floor(Date.now() / 1000);
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
  return data;
}

export async function logout() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function getSession() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const session = result[STORAGE_KEY];

  if (!session) return null;

  // Check if token is expired (giving a 5 min buffer)
  const expiresAt = (session.created_at || Math.floor(Date.now() / 1000)) + session.expires_in;
  const now = Math.floor(Date.now() / 1000);

  if (now >= expiresAt - 300) {
    // Attempt refresh
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: await getHeaders(false),
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Refresh failed');
      
      data.created_at = now;
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
      return data;
    } catch (e) {
      console.error('Failed to refresh token:', e);
      await logout();
      return null;
    }
  }

  return session;
}

export async function checkDuplicate(english_word) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?user_id=eq.${session.user.id}&english_word=ilike.${encodeURIComponent(english_word)}&select=id,english_word`, {
    method: 'GET',
    headers: await getHeaders(true),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Duplicate check failed');

  return data.length > 0;
}

export async function saveWord(payload) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  
  payload.user_id = session.user.id;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/words`, {
    method: 'POST',
    headers: {
      ...(await getHeaders(true)),
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Kelime kaydedilemedi');

  return data[0];
}

export async function getRecentWords(limit = 5) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?user_id=eq.${session.user.id}&select=*&order=created_at.desc&limit=${limit}`, {
    method: 'GET',
    headers: await getHeaders(true),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Son kelimeler alınamadı');

  return data;
}
