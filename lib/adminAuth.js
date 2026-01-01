import { getSupabase } from "@/lib/supabaseClient";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Supabase auth can be briefly "flaky" right after a cold load (especially on CF Pages).
 * These helpers retry a few times before treating the session/user as missing.
 */

export async function getSessionWithRetry({ attempts = 5, baseDelayMs = 200 } = {}) {
  let lastErr = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data?.session) return data.session;
      // No session yet — retry.
    } catch (e) {
      lastErr = e;
    }

    // Exponential-ish backoff: 200, 300, 450, 675...
    const delay = Math.round(baseDelayMs * Math.pow(1.5, i));
    await sleep(delay);
  }

  if (lastErr) throw lastErr;
  return null;
}

export async function getAccessTokenWithRetry(opts) {
  const session = await getSessionWithRetry(opts);
  return session?.access_token || null;
}

export async function getUserWithRetry({ attempts = 5, baseDelayMs = 200 } = {}) {
  let lastErr = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data?.user) return data.user;
      // No user yet — retry.
    } catch (e) {
      lastErr = e;
    }

    const delay = Math.round(baseDelayMs * Math.pow(1.5, i));
    await sleep(delay);
  }

  if (lastErr) throw lastErr;
  return null;
}
