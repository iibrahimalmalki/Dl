// شكاوى سويتر — منطق نقي (بلا DOM ولا Supabase): البحث، الفلاتر، العدّادات، والتحقق من الصور والروابط.
import { normalizeId } from "./errors";

/* ── البحث برقم الشكوى أو الطلب ── */
// تطبيع: أرقام عربية/هندية/بنغالية ← لاتينية، حذف المسافات و«#»؛ أقل من حرفين ⇒ لا بحث (null)
export function normSearch(q) {
  const s = normalizeId(q).replace(/#/g, "").replace(/[^\w\-]/g, "");
  return s.length >= 2 ? s : null;
}
// شرط PostgREST لـ .or(): رقم سويتر ورقم الحجز بمطابقة من البداية، ورقمنا الداخلي بمطابقة تامة (عمود رقمي)
export function searchOrFilter(q) {
  const s = normSearch(q);
  if (!s) return null;
  const parts = [`sweater_ticket_no.ilike.${s}*`, `booking_ref.ilike.${s}*`];
  if (/^\d+$/.test(s) && s.length <= 12) parts.push(`ticket_no.eq.${Number(s)}`);
  return parts.join(",");
}
// نفس الشرط محلياً (للاختبار ولتصفية النتائج المحمّلة)
export function matchTicket(t, q) {
  const s = normSearch(q);
  if (!s || !t) return false;
  const lc = s.toLowerCase(), pre = v => v != null && String(v).toLowerCase().startsWith(lc);
  return pre(t.sweater_ticket_no) || pre(t.booking_ref) || (/^\d+$/.test(s) && t.ticket_no != null && Number(t.ticket_no) === Number(s));
}

/* ── فلتر البايكر + التبويب ── */
export const bikerKey = t => String((t && (t.sweater_id || t.biker_name)) || "").trim() || "—";
// قائمة البايكرز في النطاق المعروض: [{key, name, id, n}] مرتّبة بالعدد ثم الاسم
export function bikerOptions(rows) {
  const m = new Map();
  (rows || []).forEach(t => {
    const k = bikerKey(t), cur = m.get(k) || { key: k, name: t.biker_name || "—", id: t.sweater_id || "", n: 0 };
    cur.n++; if (!cur.name || cur.name === "—") cur.name = t.biker_name || cur.name; m.set(k, cur);
  });
  return [...m.values()].sort((a, b) => b.n - a.n || String(a.name).localeCompare(String(b.name)));
}
export const TABS = [["all", "الكل"], ["pending_review", "بانتظار المراجعة"], ["reviewed", "بانتظار الاعتماد"], ["approved", "معتمدة"], ["rejected", "مرفوضة"]];
export function inTab(t, tab) {
  if (!tab || tab === "all") return true;
  if (tab === "approved" || tab === "rejected") return t.decision === tab;
  return t.status === tab;
}
export const byBiker = (rows, biker) => (biker ? (rows || []).filter(t => bikerKey(t) === biker) : (rows || []));
// الفلاتر الثلاثة تتقاطع: (الشهر محمّل مسبقاً) ∩ البايكر ∩ التبويب
export const applyFilters = (rows, { biker, tab }) => byBiker(rows, biker).filter(t => inTab(t, tab));
// عدّادات التبويبات بعد فلتر البايكر
export function tabCounts(rows, biker) {
  const r = byBiker(rows, biker), out = {};
  TABS.forEach(([k]) => { out[k] = r.filter(t => inTab(t, k)).length; });
  return out;
}

/* ── التحقق من الصورة ── */
// توقيع الملف: JPEG · PNG · WebP · HEIC/HEIF (و GIF)
export function imageKind(bytes) {
  const b = bytes || [], at = (i, arr) => arr.every((v, j) => b[i + j] === v), str = (i, n) => String.fromCharCode(...Array.from(b.slice ? b.slice(i, i + n) : []).slice(0, n));
  if (b.length < 12) return null;
  if (at(0, [0xFF, 0xD8, 0xFF])) return "jpeg";
  if (at(0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return "png";
  if (str(0, 4) === "RIFF" && str(8, 4) === "WEBP") return "webp";
  if (str(4, 4) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(str(8, 4))) return "heic";
  if (str(0, 4) === "GIF8") return "gif";
  return null;
}
export const isImageResponse = (contentType, bytes) => /^image\//i.test(String(contentType || "")) && !!imageKind(bytes);

// فحص الرابط قبل السحب: رابط صفحة تذكرة سويتر ⇒ مرفوض؛ رقم تذكرة مخالف ⇒ تنبيه
export const PAGE_URL_MSG = "هذا رابط صفحة لا رابط صورة. اضغط مطوّلاً على الصورة في سويتر واختر «نسخ عنوان الصورة»، أو احفظها على جهازك وارفعها من «إضافة صور».";
export function checkTicketUrl(url, ticket) {
  const u = String(url || "").trim();
  if (!/^https?:\/\/\S+$/i.test(u)) return { ok: false, code: "BAD_URL", msg: "رابط غير صالح — يجب أن يبدأ بـ http أو https" };
  let host = "", path = "";
  try { const x = new URL(u); host = x.hostname.toLowerCase(); path = x.pathname; } catch (e) { return { ok: false, code: "BAD_URL", msg: "رابط غير صالح" }; }
  if (/(^|\.)ssp-portal\.sweater\.sa$/.test(host) && /\/tickets\/\d+\/?$/i.test(path)) return { ok: false, code: "PAGE_URL", msg: PAGE_URL_MSG };
  const m = u.match(/tickets?[\/_\-=](\d{5,})/i), inUrl = m ? m[1] : null, mine = ticket && ticket.sweater_ticket_no ? String(ticket.sweater_ticket_no).trim() : null;
  const mismatch = !!(inUrl && mine && inUrl !== mine);
  return { ok: true, url: u, ticketInUrl: inUrl, mismatch, warn: mismatch ? `رقم التذكرة في الرابط (${inUrl}) لا يطابق هذه الشكوى (${mine}).` : null };
}
// رابط صفحة سويتر محفوظ في sweater_pic_url لا يُعرض كصورة
export const isPageUrl = url => !checkTicketUrl(url).ok && checkTicketUrl(url).code === "PAGE_URL";

/* ── تسمية الشهر ── */
const MON = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const periodLabel = p => { const [y, m] = String(p || "").split("-"); return MON[+m - 1] ? `${MON[+m - 1]} ${y}` : String(p || "—"); };
