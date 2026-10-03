// طبقة بيانات الاستلام اليومي (Supabase). تتحمّل غياب الجداول قبل تطبيق docs/sql/daily_receive.sql:
// القراءة تُرجع ready:false والكتابة تُرجع {missing:true}.
import { supabase, SUPA_URL, SUPA_ANON, ensureFreshToken } from "../supabase";
import { normPhone } from "./engine";
import { compressImage } from "./compress";
export { compressImage };

export const BUCKET = "daily-receipts";
const MISSING = e => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || e.code === "42883"
  || /(daily_|sweater_couriers)/.test(String(e.message || "")) && /(does not exist|Could not find|schema cache)/i.test(String(e.message || "")));
const res = r => ({ data: r.data || [], missing: MISSING(r.error), error: r.error && !MISSING(r.error) ? r.error : null });
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

async function session() {
  const fresh = await ensureFreshToken();
  const { data } = await supabase.auth.getSession(); const s = data && data.session;
  if (!fresh.ok || !s) throw new Error("انتهت الجلسة — سجّل الدخول من جديد");
  return s;
}

const SHARE_SEL = "id,delivery_id,employee_id,item_key,qty,status,qty_actual,note,confirmed_at,daily_deliveries(received_by,received_at,status,courier_id)";
const DEL_SEL = "id,operator_id,received_by,courier_id,received_at,towels_returned,photos,note,status,created_at,shared_sweater_at,shared_ops_at,daily_delivery_lines(item_key,qty)";
const flatShare = s => ({ ...s, received_by: s.daily_deliveries && s.daily_deliveries.received_by, received_at: s.daily_deliveries && s.daily_deliveries.received_at });

// بوابة البايكر: الأصناف، المندوبون، فريق المشغّل، آخر التسليمات، الأنصبة المرتبطة بي، تسوياتي
export async function loadBiker(empId, uid) {
  const [it, co, tm, dl, sh, ad, op, me] = await Promise.all([
    supabase.from("daily_items").select("*").order("sort"),
    supabase.from("sweater_couriers").select("id,operator_id,name,phone,active").eq("active", true).order("name"),
    supabase.rpc("daily_team"),
    supabase.from("daily_deliveries").select(DEL_SEL).order("received_at", { ascending: false }).limit(40),
    supabase.from("daily_shares").select(SHARE_SEL).limit(2000),
    supabase.from("daily_adjustments").select("id,employee_id,item_key,delta,reason,created_at").eq("employee_id", empId).limit(1000),
    supabase.rpc("my_operator_id"),
    uid ? supabase.from("app_users").select("in_daily_split").eq("id", uid).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const R = [it, co, tm, dl, sh, ad].map(res);
  return { items: R[0].data, couriers: R[1].data, team: R[2].data, deliveries: R[3].data, shares: R[4].data.map(flatShare), adjustments: R[5].data, operatorId: op.error ? null : op.data,
    inSplit: !(me && !me.error && me.data && me.data.in_daily_split === false),
    ready: !R.some(r => r.missing), error: (R.find(r => r.error) || {}).error || null };
}

// صفحة المتابعة
export async function loadAdmin() {
  const [it, co, dl, sh, ad, em] = await Promise.all([
    supabase.from("daily_items").select("*").order("sort"),
    supabase.from("sweater_couriers").select("*").order("name"),
    supabase.from("daily_deliveries").select(DEL_SEL).order("received_at", { ascending: false }).limit(2000),
    supabase.from("daily_shares").select(SHARE_SEL).limit(20000),
    supabase.from("daily_adjustments").select("*").order("created_at", { ascending: false }).limit(5000),
    supabase.from("employees").select("id,full_name,employee_id,operator_id,staff_role").not("employee_id", "is", null).order("full_name"),
  ]);
  const R = [it, co, dl, sh, ad, em].map(res);
  return { items: R[0].data, couriers: R[1].data, deliveries: R[2].data, shares: R[3].data.map(flatShare), adjustments: R[4].data,
    employees: R[5].data.filter(e => e.staff_role !== "manager"), ready: !R.slice(0, 5).some(r => r.missing), error: (R.find(r => r.error) || {}).error || null };
}

async function uploadPhoto(path, blob) {
  const s = await session();
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${s.access_token}`, apikey: SUPA_ANON, "Content-Type": "image/jpeg", "x-upsert": "false" }, body: blob });
  if (!r.ok) { let m = "HTTP " + r.status; try { const j = await r.json(); m = j.message || j.error || m; } catch { /* */ } throw new Error(m); }
  return path;
}

const urlCache = {};
export async function photoUrl(path) {
  const c = urlCache[path]; if (c && c.exp > Date.now() + 60e3) return c.url;
  const s = await session();
  const r = await fetch(`${SUPA_URL}/storage/v1/object/sign/${BUCKET}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${s.access_token}`, apikey: SUPA_ANON, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }) });
  if (!r.ok) return null;
  const j = await r.json(); const u = j.signedURL || j.signedUrl; if (!u) return null;
  const url = SUPA_URL + "/storage/v1" + u; urlCache[path] = { url, exp: Date.now() + 3600e3 }; return url;
}

// حفظ الاستلام: المندوب (جديد أو موجود) ← رفع الصور ← التسليم ← الأسطر
// f: {received_at, courier_id | newCourier{name,phone}, qty{[item]:n}, towels_returned, photos:[File], note}
export async function createDelivery({ empId, operatorId, couriers }, f, onStep) {
  const step = t => onStep && onStep(t);
  let courierId = f.courier_id;
  if (!courierId) {
    const phone = normPhone(f.newCourier.phone), ex = (couriers || []).find(c => c.phone === phone && c.operator_id === operatorId);
    if (ex) courierId = ex.id;
    else {
      step("courier");
      const s = await session();
      const r = await supabase.from("sweater_couriers").insert({ operator_id: operatorId, name: f.newCourier.name.trim(), phone, created_by: s.user.id }).select("id").single();
      if (r.error) {
        if (MISSING(r.error)) return { missing: true };
        if (r.error.code === "23505") { const q = await supabase.from("sweater_couriers").select("id").eq("phone", phone).limit(1); courierId = q.data && q.data[0] && q.data[0].id; }
        if (!courierId) return { error: r.error };
      } else courierId = r.data.id;
    }
  }
  const id = uuid(), paths = [];
  for (let i = 0; i < f.photos.length; i++) {
    step("photo" + (i + 1));
    const blob = await compressImage(f.photos[i]);
    paths.push(await uploadPhoto(`${id}/${i + 1}-${Date.now()}.jpg`, blob));
  }
  step("save");
  const d = await supabase.from("daily_deliveries").insert({ id, operator_id: operatorId, received_by: empId, courier_id: courierId, received_at: new Date(f.received_at).toISOString(),
    towels_returned: f.towels_returned || 0, photos: paths, note: (f.note || "").trim() || null }).select(DEL_SEL.replace(",daily_delivery_lines(item_key,qty)", "")).single();
  if (d.error) return MISSING(d.error) ? { missing: true } : { error: d.error };
  const lines = Object.entries(f.qty).filter(([, q]) => q > 0).map(([item_key, qty]) => ({ delivery_id: id, item_key, qty }));
  const l = await supabase.from("daily_delivery_lines").insert(lines);
  if (l.error) return { error: l.error, delivery: d.data };
  return { delivery: { ...d.data, daily_delivery_lines: lines.map(({ item_key, qty }) => ({ item_key, qty })) }, courierId };
}

// اعتماد التوزيع: plan {[item]: {[empId]: qty}} — نصيب المستلم confirmed تلقائياً، والباقي pending
export async function saveDistribution(delivery, plan, empId) {
  const now = new Date().toISOString(), rows = [];
  Object.entries(plan).forEach(([item_key, per]) => Object.entries(per).forEach(([employee_id, qty]) => { if (qty > 0) rows.push({ delivery_id: delivery.id, employee_id, item_key, qty, status: employee_id === empId ? "confirmed" : "pending", confirmed_at: employee_id === empId ? now : null }); }));
  if (rows.length) { const r = await supabase.from("daily_shares").insert(rows); if (r.error) return { error: r.error }; }
  const u = await supabase.from("daily_deliveries").update({ status: "distributed" }).eq("id", delivery.id);
  if (u.error) return { error: u.error };
  return { ok: true };
}

// تأكيد البايكر لنصيبه: actual {[shareId]: n} للناقص فقط
export async function confirmShares(shares, actual, note) {
  const now = new Date().toISOString();
  for (const s of shares) {
    const a = actual && actual[s.id] != null ? Math.max(0, Math.min(s.qty, +actual[s.id])) : null, short = a != null && a < s.qty;
    const r = await supabase.from("daily_shares").update({ status: short ? "short" : "confirmed", qty_actual: short ? a : null, note: short ? (note || null) : null, confirmed_at: now }).eq("id", s.id).eq("status", "pending");
    if (r.error) return { error: r.error };
  }
  return { ok: true };
}

/* ── إدارة (المالك/المشرف) ── */
export async function addAdjustment(row) { const s = await session(); const r = await supabase.from("daily_adjustments").insert({ ...row, created_by: s.user.id }); return r.error ? { error: r.error } : { ok: true }; }
export async function saveItem(row, isNew) { const r = isNew ? await supabase.from("daily_items").insert(row) : await supabase.from("daily_items").update(row).eq("key", row.key); return r.error ? { error: r.error } : { ok: true }; }
// تسجيل أول ضغطة «نسخ/إرسال» لرسالة القروب (للمستلم فقط؛ فشلها لا يمنع النسخ)
export async function markShared(deliveryId, kind) { try { const r = await supabase.rpc("mark_daily_shared", { p_delivery: deliveryId, p_kind: kind }); return r.error ? { error: r.error } : { ok: true }; } catch (e) { return { error: e }; } }

// نسخ نص إلى الحافظة مع بديل textarea + execCommand
export async function copyText(t) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch { /* بديل */ }
  try { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(a); a.select(); a.setSelectionRange(0, t.length); const ok = document.execCommand("copy"); a.remove(); return ok; } catch { return false; }
}

// المشمولون بالتوزيع (للمالك والمشرف)
export async function loadSplit() { const r = await supabase.rpc("daily_split_list"); return r.error ? { list: [], missing: MISSING(r.error), error: MISSING(r.error) ? null : r.error } : { list: r.data || [] }; }
export async function setSplit(empId, on) { const r = await supabase.rpc("set_daily_split", { p_employee: empId, p_on: on }); return r.error ? { error: r.error } : { ok: true, n: r.data }; }
export async function saveCourier(id, patch) { const r = await supabase.from("sweater_couriers").update(patch).eq("id", id); return r.error ? { error: r.error } : { ok: true }; }
