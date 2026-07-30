import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// ⚠️ الأسرار تُقرأ من متغيّرات بيئة Supabase — لا تضع التوكن هنا.
// اضبطها: Supabase Dashboard → Edge Functions → Secrets: WHAPI_TOKEN, ADMIN_WA
const TOKEN = Deno.env.get("WHAPI_TOKEN") || "";
const ADMIN_WA = Deno.env.get("ADMIN_WA") || "966564884419@s.whatsapp.net";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const a = await req.json();
    const loc = a.location === "inside_ksa" ? `الرياض: ${a.saudi_city || "—"}` : `${a.bangladesh_district || ""} — ${a.bangladesh_city || ""}`;
    const body = `🔔 طلب توظيف جديد!\n👤 ${a.full_name} | ${a.age} سنة\n📍 ${loc}\n${a.location === "inside_ksa" ? `✈️ مستعد للرياض: ${a.ready_for_riyadh === "yes" ? "✅ نعم" : "❌ لا"}\n` : ""}🏍️ رخصة: ${a.has_license === "yes" ? "✅" : "❌"} | 📊 المنطقة: ${a.geo_score ?? "—"} | 🤖 التقييم: ${a.ai_score ?? "—"} (${a.ai_classification || "—"})${a.referred_by ? `\n👥 إحالة: ${a.referred_by}` : ""}\n\n👉 https://db1-sandy.vercel.app/#admin`;
    if (!TOKEN) return new Response(JSON.stringify({ ok: false, error: "WHAPI_TOKEN not set" }), { headers: { ...cors, "Content-Type": "application/json" } });
    const r = await fetch("https://gate.whapi.cloud/messages/text", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` }, body: JSON.stringify({ to: ADMIN_WA, body }) });
    return new Response(JSON.stringify({ ok: r.ok }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
