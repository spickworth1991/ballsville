// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

let _supabase = null;

function readMeta(name) {
  if (typeof document === "undefined") return "";
  const el = document.querySelector(`meta[name="${name}"]`);
  return el?.content || "";
}

export function getSupabase() {
  if (typeof window === "undefined") return null; // never run during export

  if (_supabase) return _supabase;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    readMeta("supabase-url") ||
    "";
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    readMeta("supabase-anon") ||
    "";

  if (!url || !anon) {
    console.warn("Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
    throw new Error("Missing Supabase configuration — set env vars in Cloudflare Pages Preview/Production.");
  }

  _supabase = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _supabase;
}
