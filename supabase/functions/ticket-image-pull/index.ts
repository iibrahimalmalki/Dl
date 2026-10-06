// ticket-image-pull — يسحب صورة شكوى من رابط سويتر ويخزّنها في حاوية sweater-tickets.
// المصدر: نُقل من النسخة المنشورة (الإصدار 1، verify_jwt=false) وعُدِّل هنا. لا يُنشر إلا بموافقة المالك:
//   supabase functions deploy ticket-image-pull --no-verify-jwt --project-ref cnmggdrlkgsyrjxmvydv
// التعديل (06/10/2026): يُرفض أي رد ليس نوعه image/* أو لا تبدأ بياناته بتوقيع صورة
// (JPEG / PNG / WebP / HEIC / GIF) — لا يُحفظ شيء ولا يُعدَّل الصف، ويُعاد الرمز NOT_IMAGE.
// سببه: لصق رابط «صفحة» التذكرة (ssp-portal.sweater.sa/tickets/<n>) كان يحفظ صفحة HTML باسم .jpg ويُعلَّم has_image=true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "sweater-tickets";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function safePath(p: string): string | null {
  if (!p) return null;
  if (p.includes("..") || p.startsWith("/")) return null;
  if (!/^[A-Za-z0-9_\-\/\.]+$/.test(p)) return null;
  if (p.length > 300) return null;
  return p;
}
// نسمح فقط بمصادر سويتر المعروفة
function allowedSource(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.endsWith(".cloudfront.net") || h.endsWith("sweatp.com") || h.endsWith("sweatp.co") || h.includes("sweat");
  } catch { return false; }
}
// رابط صفحة تذكرة في بوابة سويتر — ليس صورة
function isTicketPage(u: string): boolean {
  try { const x = new URL(u); return /(^|\.)ssp-portal\.sweater\.sa$/i.test(x.hostname) && /\/tickets\/\d+\/?$/i.test(x.pathname); }
  catch { return false; }
}
// توقيع الصورة من أول البايتات (مطابق لـ imageKind في src/ticketsLib.js)
function imageKind(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  const at = (i: number, a: number[]) => a.every((v, j) => b[i + j] === v);
  const str = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (at(0, [0xFF, 0xD8, 0xFF])) return "jpeg";
  if (at(0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return "png";
  if (str(0, 4) === "RIFF" && str(8, 4) === "WEBP") return "webp";
  if (str(4, 4) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(str(8, 4))) return "heic";
  if (str(0, 4) === "GIF8") return "gif";
  return null;
}
const NOT_IMAGE = { error: "NOT_IMAGE", message: "هذا رابط صفحة لا رابط صورة. اضغط مطوّلاً على الصورة في سويتر واختر «نسخ عنوان الصورة»، أو احفظها على جهازك وارفعها من «إضافة صور»." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "NO_TOKEN", message: "انتهت الجلسة — سجّل الدخول من جديد" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: u, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !u?.user) return json({ error: "INVALID_TOKEN", message: "انتهت الجلسة — سجّل الدخول من جديد" }, 401);
    const uid = u.user.id;
    const { data: appu } = await admin.from("app_users").select("is_owner, active").eq("id", uid).maybeSingle();
    if (!appu || appu.active === false) return json({ error: "NO_USER", message: "مستخدم غير مُفعّل" }, 403);
    let allowed = !!appu.is_owner;
    if (!allowed) {
      const { data: perm } = await admin.from("user_permissions").select("can_view, can_edit").eq("user_id", uid).eq("module", "complaints").maybeSingle();
      allowed = !!(perm && perm.can_edit);
    }
    if (!allowed) return json({ error: "FORBIDDEN", message: "لا تملك صلاحية إدارة الشكاوى" }, 403);

    const body = await req.json().catch(() => null) as { url?: string; path?: string; ticket_id?: string } | null;
    if (!body?.url || !body?.path) return json({ error: "BAD_INPUT", message: "url و path مطلوبان" }, 400);
    const path = safePath(body.path);
    if (!path) return json({ error: "BAD_PATH", message: "مسار غير صالح" }, 400);
    if (isTicketPage(body.url)) return json(NOT_IMAGE, 422);
    if (!allowedSource(body.url)) return json({ error: "BAD_SOURCE", message: "مصدر الصورة غير مسموح" }, 400);

    const r = await fetch(body.url, { headers: { "User-Agent": "Mozilla/5.0 DaluWarghwah", "Accept": "image/*" } });
    if (!r.ok) return json({ error: "FETCH_FAILED", message: "تعذّر جلب الصورة (" + r.status + ")" }, 502);
    const contentType = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!bytes.length) return json({ error: "EMPTY", message: "الصورة فارغة" }, 502);
    if (bytes.length > 20 * 1024 * 1024) return json({ error: "TOO_LARGE", message: "الحجم يتجاوز 20MB" }, 413);
    // الجديد: النوع المعلن والتوقيع الفعلي معاً، وإلا فلا حفظ ولا تعديل
    const kind = imageKind(bytes);
    if (!contentType.startsWith("image/") || !kind) return json({ ...NOT_IMAGE, got: contentType || "unknown" }, 422);
    const storeType = kind === "heic" ? "image/heic" : `image/${kind}`;

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: storeType, upsert: true });
    if (upErr) return json({ error: "UPLOAD_FAILED", message: upErr.message }, 500);
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;

    if (body.ticket_id) {
      await admin.from("ops_tickets").update({ stored_pic_path: path, has_image: true }).eq("id", body.ticket_id);
    }
    return json({ url, path, kind });
  } catch (e) {
    return json({ error: "SERVER", message: String((e as Error)?.message || e) }, 500);
  }
});
