const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZHhna2pjaG5jdXB2Ymtza2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMzkzNTIsImV4cCI6MjEwMzgxNTM1Mn0.kbqZDu8aifd2plMz0uZ-BNvUXbmAUGN7tQidd5HWGpc";
const BASE = "https://hhdxnkjchncupvbksklf.supabase.co/functions/v1";

export async function callFn(fn: "movilizadores" | "choferes" | "fiscales", token: string, body: Record<string, unknown>) {
  const r = await fetch(`${BASE}/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return r.json();
}

const SESSION_KEY_PREFIX = "et_ext_token_";

export function saveToken(fn: string, token: string) {
  try {
    sessionStorage.setItem(SESSION_KEY_PREFIX + fn, token);
  } catch {}
}

export function loadToken(fn: string): string {
  try {
    return sessionStorage.getItem(SESSION_KEY_PREFIX + fn) ?? "";
  } catch {
    return "";
  }
}

export function clearToken(fn: string) {
  try {
    sessionStorage.removeItem(SESSION_KEY_PREFIX + fn);
  } catch {}
}
