// طبقة بيانات «الدعم والأفكار» و«متتبع الحصر» (Supabase). تتحمّل غياب الجداول قبل تطبيق docs/sql/launch_support.sql:
// القراءة تُرجع ready:false، والكتابة تُرجع خطأ مفهوماً.
import { supabase, ensureFreshToken } from "../supabase";
import { compressImage } from "../daily/compress";

export const SHOTS = "support-shots";
const MISSING = e => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || e.code === "42883"
  || /(support_tickets|relaunch_steps|relaunch_roster)/.test(String(e.message || "")) && /(does not exist|Could not find|schema cache)/i.test(String(e.message || "")));
const res = r => ({ data: r.data || [], missing: MISSING(r.error), error: r.error && !MISSING(r.error) ? r.error : null });
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const SEL = "id,seq,user_id,biker_name,biker_employee_id,kind,body,screen,photos,status,reply,replied_at,supply_request_id,created_at,updated_at";

// البايكر: طلباتي فقط (السياسة تقصرها عليه)
export async function loadMyTickets(uid) {
  const r = res(await supabase.from("support_tickets").select(SEL).eq("user_id", uid).order("created_at", { ascending: false }).limit(100));
  return { tickets: r.data, ready: !r.missing, error: r.error };
}

// رفع اللقطات (مضغوطة) ثم إدراج الطلب. هوية البايكر والحالة يضبطها الخادم.
export async function submitTicket({ uid, kind, body, screen, files = [] }) {
  const fresh = await ensureFreshToken();
  if (!fresh.ok) return { error: { message: "انتهت الجلسة — سجّل الدخول من جديد" } };
  const photos = [];
  for (const f of files.slice(0, 3)) {
    let blob = f; try { blob = await compressImage(f); } catch (e) { /* يُرفع الأصل */ }
    const path = `${uid}/${uuid()}.jpg`;
    const { error } = await supabase.storage.from(SHOTS).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) return { error: MISSING(error) || /bucket/i.test(String(error.message)) ? { message: "مركز الدعم لم يُفعَّل بعد على الخادم." } : error };
    photos.push(path);
  }
  const { data, error } = await supabase.from("support_tickets").insert({ kind, body: String(body).trim(), screen: screen || null, photos }).select(SEL).single();
  if (error) return { error: MISSING(error) ? { message: "مركز الدعم لم يُفعَّل بعد على الخادم." } : error };
  return { ticket: data };
}

// السفير/المالك: كل الطلبات
export async function loadInbox() {
  const r = res(await supabase.from("support_tickets").select(SEL).order("created_at", { ascending: false }).limit(500));
  return { tickets: r.data, ready: !r.missing, error: r.error };
}
export async function replyTicket(id, { status, reply }) {
  const { data, error } = await supabase.from("support_tickets").update({ status, reply: String(reply || "").trim() || null }).eq("id", id).select(SEL).single();
  return { ticket: data, error };
}
export async function openTicketsCount() {
  const { count, error } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["new", "in_review"]);
  return error ? 0 : count || 0;
}

const urlCache = {};
export async function shotUrl(path) {
  const c = urlCache[path]; if (c && c.exp > Date.now() + 60e3) return c.url;
  const { data, error } = await supabase.storage.from(SHOTS).createSignedUrl(path, 3600);
  if (error || !data) return null;
  urlCache[path] = { url: data.signedUrl, exp: Date.now() + 3600e3 }; return data.signedUrl;
}

// ═══ متتبع الحصر ═══
export async function loadTracker() {
  const [ro, st] = await Promise.all([supabase.rpc("relaunch_roster"), supabase.from("relaunch_steps").select("employee_id,step,status,note,decided_by,decided_at")]);
  const R = [ro, st].map(res);
  return { roster: R[0].data, steps: R[1].data, ready: !R.some(r => r.missing), error: (R.find(r => r.error) || {}).error || null };
}
export async function saveStep({ employee_id, step, status, note }) {
  const { error } = await supabase.from("relaunch_steps").upsert({ employee_id, step, status, note: String(note || "").trim() || null }, { onConflict: "employee_id,step" });
  return { error };
}
// البايكر: حالة خطوات حصري (السياسة تقصرها عليه)
export async function loadMySteps(empId) {
  if (!empId) return { steps: [], ready: true };
  const r = res(await supabase.from("relaunch_steps").select("employee_id,step,status,note,decided_at").eq("employee_id", empId));
  return { steps: r.data, ready: !r.missing, error: r.error };
}
