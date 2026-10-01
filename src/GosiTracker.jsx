import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useToast } from "./ui";

/*  متتبّع التأمينات الاجتماعية (GOSI) — دلو ورغوة
    يعرض: الرصيد المستحق، خطة التقسيط، السجل الشهري، تنبيه الاستحقاق، وتسجيل الدفعات.
    للمالك/المالية فقط (RLS).
*/

const CSS = `
.gt-wrap{font-family:'Tajawal',system-ui,sans-serif;direction:rtl;color:var(--ink)}
.gt-grid{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.gt-kpi{flex:1;min-width:150px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.gt-kpi .k{font-size:12px;color:var(--mut)}
.gt-kpi .v{font-size:22px;font-weight:800;margin-top:3px}
.gt-kpi .v.red{color:var(--bad-ink)}.gt-kpi .v.amber{color:var(--warn-ink)}.gt-kpi .v.green{color:var(--ok-ink)}
.gt-alert{border-radius:10px;padding:12px 15px;font-size:13px;margin-bottom:14px;font-weight:600}
.gt-a-red{background:var(--bad-bg);color:var(--bad-ink);border:1px solid color-mix(in srgb,var(--bad) 35%,transparent)}
.gt-a-amber{background:var(--warn-bg);color:var(--warn-ink);border:1px solid color-mix(in srgb,var(--warn) 35%,transparent)}
.gt-a-green{background:var(--ok-bg);color:var(--ok-ink);border:1px solid color-mix(in srgb,var(--ok) 35%,transparent)}
.gt-card{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:14px}
.gt-card h3{font-size:15px;font-weight:800;color:var(--ok-ink);margin:0 0 10px}
.gt-inst{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.gt-inst .c{background:var(--soft);border:1px solid var(--line);border-radius:9px;padding:10px 12px}
.gt-inst .c .k{font-size:11px;color:var(--mut)}.gt-inst .c .v{font-size:15px;font-weight:800;margin-top:2px}
table.gt-t{width:100%;border-collapse:collapse}
.gt-t th{background:var(--soft);color:var(--ink-2);font-size:12px;font-weight:700;padding:8px 10px;text-align:right;border-bottom:2px solid var(--line)}
.gt-t td{padding:8px 10px;font-size:12.5px;border-bottom:1px solid var(--line);text-align:right}
.gt-t td.c,.gt-t th.c{text-align:center}
.gt-badge{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px}
.gt-paid{background:var(--ok-bg);color:var(--ok-ink)}.gt-part{background:var(--p-100);color:var(--warn-ink)}.gt-unpaid{background:var(--bad-bg);color:var(--bad-ink)}
.gt-form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:6px}
.gt-form .fld{display:flex;flex-direction:column;gap:4px}
.gt-form label{font-size:11.5px;color:var(--ink-2);font-weight:700}
.gt-form input{padding:9px 11px;border:1px solid var(--line-2);border-radius:8px;font-family:inherit;font-size:14px;background:var(--soft)}
.gt-btn{padding:10px 16px;background:var(--ok);color:#fff;border:none;border-radius:9px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
.gt-btn:disabled{opacity:.6}
.gt-msg{margin-top:8px;padding:9px 12px;border-radius:8px;font-size:12.5px;font-weight:600}
.gt-ok{background:var(--ok-bg);color:var(--ok-ink)}.gt-err{background:var(--bad-bg);color:var(--bad-ink)}
.gt-sub{font-size:11.5px;color:var(--mut);margin-top:2px}
`;

const fmt = (n) => Number(n || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthName = (p) => {
  const [y, m] = (p || "").split("-");
  const names = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return names[Number(m) - 1] ? names[Number(m) - 1] + " " + y : p;
};

export default function GosiTracker() {
  const [rows, setRows] = useState([]);
  const [inst, setInst] = useState(null);
  const toast = useToast();
  const [msg, setMsgRaw] = useState(null);
  // رسائل النجاح → Toast؛ الأخطاء تبقى في الصفحة
  const setMsg = (x) => { if (x && x.t === "ok") { toast.ok(x.m); setMsgRaw(null); } else setMsgRaw(x); };
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ period: "", accrual: "", paid: "", date: "" });

  async function load() {
    const { data: led } = await supabase.from("gosi_ledger").select("*").order("period");
    setRows(led || []);
    const { data: gi } = await supabase.from("gosi_installment").select("*").order("created_at", { ascending: false }).limit(1);
    setInst(gi && gi[0] ? gi[0] : null);
    // default next period
    if (led && led.length) {
      const last = led[led.length - 1].period;
      const [y, m] = last.split("-").map(Number);
      const nm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      setForm(f => ({ ...f, period: nm }));
    }
  }
  useEffect(() => { load(); }, []);

  const balance = rows.length ? Number(rows[rows.length - 1].closing_balance) : 0;
  const lastPeriod = rows.length ? rows[rows.length - 1].period : "—";

  async function recordPayment() {
    setMsg(null);
    const p = form.period.trim();
    if (!/^\d{4}-\d{2}$/.test(p)) { setMsg({ t: "err", m: "الشهر بصيغة YYYY-MM (مثال 2026-10)." }); return; }
    const accrual = Number(form.accrual || 0), paid = Number(form.paid || 0);
    if (!accrual && !paid) { setMsg({ t: "err", m: "أدخل الاستحقاق و/أو المسدّد." }); return; }
    setBusy(true);
    try {
      const opening = balance;
      const closing = opening + accrual - paid;
      const status = paid <= 0 ? "unpaid" : (closing > 0.01 ? "partial" : "paid");
      const { error } = await supabase.from("gosi_ledger").upsert({
        period: p, opening_balance: opening, accrual, paid, closing_balance: closing,
        due_date: form.date || null, status, notes: "أُدخل عبر المتتبّع",
      }, { onConflict: "period" });
      if (error) throw error;
      setMsg({ t: "ok", m: "تم تسجيل الحركة ✅" });
      setForm(f => ({ ...f, accrual: "", paid: "", date: "" }));
      load();
    } catch (e) { setMsg({ t: "err", m: "خطأ: " + (e.message || e) }); }
    setBusy(false);
  }

  const balClass = balance > 5000 ? "red" : (balance > 0 ? "amber" : "green");

  return (
    <div className="gt-wrap">
      <style>{CSS}</style>

      <div className="gt-grid">
        <div className="gt-kpi"><div className="k">الرصيد المستحق حالياً</div><div className={"v " + balClass}>{fmt(balance)} ﷼</div><div className="gt-sub">حتى {monthName(lastPeriod)}</div></div>
        <div className="gt-kpi"><div className="k">الاستحقاق الشهري التقديري</div><div className="v">~2,600 ﷼</div></div>
        <div className="gt-kpi"><div className="k">قسط التقسيط الشهري</div><div className="v">{inst ? fmt(inst.monthly) : "—"} ﷼</div></div>
      </div>

      {balance > 0 && (
        <div className="gt-alert gt-a-red">🔴 يوجد رصيد مستحق {fmt(balance)}﷼ — تأخّر GOSI قد يوقف تجديد/نقل الإقامات. سدّد قبل الاستحقاق لتجنّب الغرامات وإيقاف الخدمات.</div>
      )}

      {inst && (
        <div className="gt-card">
          <h3>خطة تقسيط المتأخرات</h3>
          <div className="gt-inst">
            <div className="c"><div className="k">إجمالي المتأخرات</div><div className="v">{fmt(inst.total_due)}</div></div>
            <div className="c"><div className="k">الدفعة المقدمة ({inst.down_pct}%)</div><div className="v">{fmt(inst.down_payment)}</div></div>
            <div className="c"><div className="k">عدد الأقساط</div><div className="v">{inst.months}</div></div>
            <div className="c"><div className="k">القسط الشهري</div><div className="v">{fmt(inst.monthly)}</div></div>
            <div className="c"><div className="k">من</div><div className="v" style={{ fontSize: 13 }}>{monthName(inst.start_period)}</div></div>
            <div className="c"><div className="k">إلى</div><div className="v" style={{ fontSize: 13 }}>{monthName(inst.end_period)}</div></div>
          </div>
          <div className="gt-sub" style={{ marginTop: 8 }}>الاشتراكات {fmt(inst.subscriptions)} + غرامات {fmt(inst.penalties)} + أخطار مهنية {fmt(inst.occupational)} · الحالة: {inst.status}</div>
        </div>
      )}

      <div className="gt-card">
        <h3>السجل الشهري</h3>
        <table className="gt-t">
          <thead><tr><th>الشهر</th><th class="c">الافتتاح</th><th class="c">الاستحقاق</th><th class="c">المسدّد</th><th class="c">الرصيد</th><th class="c">الحالة</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.period}>
                <td>{monthName(r.period)}</td>
                <td className="c">{fmt(r.opening_balance)}</td>
                <td className="c">{fmt(r.accrual)}</td>
                <td className="c">{fmt(r.paid)}</td>
                <td className="c" style={{ fontWeight: 800 }}>{fmt(r.closing_balance)}</td>
                <td className="c"><span className={"gt-badge " + (r.status === "paid" ? "gt-paid" : r.status === "partial" ? "gt-part" : "gt-unpaid")}>
                  {r.status === "paid" ? "مسدّد" : r.status === "partial" ? "جزئي" : "غير مسدّد"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gt-card">
        <h3>تسجيل حركة / دفعة</h3>
        <div className="gt-form">
          <div className="fld"><label>الشهر (YYYY-MM)</label><input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="2026-10" /></div>
          <div className="fld"><label>استحقاق الشهر</label><input type="number" inputMode="decimal" value={form.accrual} onChange={e => setForm({ ...form, accrual: e.target.value })} placeholder="2600" /></div>
          <div className="fld"><label>المسدّد</label><input type="number" inputMode="decimal" value={form.paid} onChange={e => setForm({ ...form, paid: e.target.value })} placeholder="525" /></div>
          <div className="fld"><label>تاريخ الاستحقاق</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <button className="gt-btn" onClick={recordPayment} disabled={busy}>{busy ? "…" : "تسجيل"}</button>
        </div>
        {msg && <div className={"gt-msg " + (msg.t === "ok" ? "gt-ok" : "gt-err")}>{msg.m}</div>}
        <div className="gt-sub" style={{ marginTop: 8 }}>الرصيد الجديد = الرصيد الحالي + الاستحقاق − المسدّد. سجّل كل شهر استحقاقه ودفعته ليبقى الرصيد دقيقاً.</div>
      </div>
    </div>
  );
}
