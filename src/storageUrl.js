// روابط ملفات التخزين: يحوّل الرابط العام المحفوظ (…/storage/v1/object/public/<bucket>/<path>) إلى رابط موقّع مؤقت،
// حتى تعمل الحاويات الخاصة دون تغيير القيم المحفوظة في الجداول.
import { supabase } from "./supabase";

const RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/;
export function parseStorageUrl(url) {
  const m = RE.exec(String(url || ""));
  if (!m) return null;
  let path = m[2];
  try { path = decodeURIComponent(path); } catch (e) { /* يبقى كما هو */ }
  return { bucket: m[1], path };
}

const TTL = 3600, cache = new Map();
// رابط موقّع لرابط عام محفوظ. رابط خارجي (غير Supabase) يعود كما هو. الفشل (لا صلاحية) ⇒ null.
export async function signedUrl(url, ttl = TTL) {
  const p = parseStorageUrl(url);
  if (!p) return url || null;
  const k = p.bucket + "/" + p.path, c = cache.get(k);
  if (c && c.exp > Date.now() + 60e3) return c.url;
  const { data, error } = await supabase.storage.from(p.bucket).createSignedUrl(p.path, ttl);
  if (error || !data || !data.signedUrl) return null;
  cache.set(k, { url: data.signedUrl, exp: Date.now() + ttl * 1000 });
  return data.signedUrl;
}
// عدة روابط دفعة واحدة ← {الرابط الأصلي: الموقّع أو null}
export async function signedUrls(urls, ttl = TTL) {
  const uniq = [...new Set((urls || []).filter(Boolean))];
  const out = await Promise.all(uniq.map(u => signedUrl(u, ttl).catch(() => null)));
  return Object.fromEntries(uniq.map((u, i) => [u, out[i]]));
}
