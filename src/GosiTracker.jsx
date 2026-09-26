import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/*  متتبّع التأمينات الاجتماعية (GOSI) — دلو ورغوة
    يعرض: الرصيد المستحق، خطة التقسيط، السجل الشهري، تنبيه الاستحقاق، وتسجيل الدفعات.
    للمالك/المالية فقط (RLS).
*/

const CSS = `
.gt-wrap{font-family:'Tajawal',system-ui,sans-serif;direction:rtl;color:#1c2630}
.gt-grid{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.gt-kpi{flex:1;min-width:150px;background:#fff;border:1px solid #e6e9ee;border-radius:12px;padding:14px 16px}
.gt-kpi .k{font-size:12px;color:#66727e}
.gt-kpi .v{font-size:22px;font-weight:800;margin-top:3px}
.gt-kpi .v.red{color:#c0392b}.gt-kpi .v.amber{color:#b3801a}.gt-kpi .v.green{color:#0f7a5c}
.gt-alert{border-radius:10px;padding:12px 15px;font-size:13px;margin-bottom:14px;font-weight:600}
.gt-a-red{background:#fdeaea;color:#8a2c1f;border:1px solid #f2c4bd}
.gt-a-amber{background:#fff8e9;color:#6f5410;border:1px solid #f0dca0}
.gt-a-green{background:#eaf5ef;color:#0f7a5c;border:1px solid #bfe0cf}
.gt-card{background:#fff;border:1px solid #e6e9ee;border-radius:12px;padding:16px;margin-bottom:14px}
.gt-card h3{font-size:15px;font-weight:800;color:#0b5c46;margin:0 0 10px}
.gt-inst{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.gt-inst .c{background:#f7f9fb;border:1px solid #e6e9ee;border-radius:9px;padding:10px 12px}
.gt-inst .c .k{font-size:11px;color:#66727e}.gt-inst .c .v{font-size:15px;font-weight:800;margin-top:2px}
table.gt-t{width:100%;border-collapse:collapse}
.gt-t th{background:#f4f6f8;color:#41505e;font-size:12px;font-weight:700;padding:8px 10px;text-align:right;border-bottom:2px solid #e6e9ee}
.gt-t td{padding:8px 10px;font-size:12.5px;border-bottom:1px solid #eef1f4;text-align:right}
.gt-t td.c,.gt-t th.c{text-align:center}
.gt-badge{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px}
.gt-paid{background:#e5f3ec;color:#0f7a5c}.gt-part{background:#fdf1e3;color:#b3801a}.gt-unpaid{background:#fdeaea;color:#c0392b}
.gt-form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:6px}
.gt-form .fld{display:flex;flex-direction:column;gap:4px}
.gt-form label{font-size:11.5px;color:#41505e;font-weight:700}
.gt-form input{padding:9px 11px;border:1px solid #d7dde3;border-radius:8px;font-family:inherit;font-size:14px;background:#fbfcfd}
.gt-btn{padding:10px 16px;background:#0f7a5c;color:#fff;border:none;border-radius:9px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
.gt-btn:disabled{opacity:.6}
.gt-msg{margin-top:8px;padding:9px 12px;border-radius:8px;font-size:12.5px;font-weight:600}
.gt-ok{background:#e5f3ec;color:#0f7a5c}.gt-err{background:#fdeaea;color:#c0392b}
.gt-sub{font-size:11.5px;color:#66727e;margin-top:2px}
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
  const [msg, setMsg] = useState(null);
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
