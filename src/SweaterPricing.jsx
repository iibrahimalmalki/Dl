import{useState,useMemo}from"react";
import Icon from"./Icon";
import{SSP_CONTRACT,PRICING_TIERS,MIN_GUARANTEE_ORDERS,PRICING_APPENDIX,tierForMonthlyOrders,payoutForBiker}from"./sweaterContract";

const money=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" ﷼";
const int=n=>Number(n||0).toLocaleString("en-US");

export default function SweaterPricing(){
  const[bikers,setBikers]=useState(SSP_CONTRACT.bikers);
  const[orders,setOrders]=useState(MIN_GUARANTEE_ORDERS); // متوسط الطلبات/بايكر/شهر
  const per=useMemo(()=>payoutForBiker(orders),[orders]);
  const curTier=useMemo(()=>tierForMonthlyOrders(orders),[orders]);

  return(<div className="sp">
    <style>{CSS}</style>

    <div className="sp-kpis">
      <div className="sp-kpi"><span className="sp-kl">الحد الأدنى المضمون / بايكر</span><b>{int(MIN_GUARANTEE_ORDERS)} طلب</b><small>Golden Guarantee</small></div>
      <div className="sp-kpi"><span className="sp-kl">سعر الطلب (العقد)</span><b>{money(SSP_CONTRACT.per_order)}</b><small>+{money(SSP_CONTRACT.incentive)} حافز = {money(SSP_CONTRACT.incentive_total)}</small></div>
      <div className="sp-kpi"><span className="sp-kl">عدد البايكرز</span><b>{SSP_CONTRACT.bikers}</b><small>حسب العقد</small></div>
      <div className="sp-kpi"><span className="sp-kl">سريان الملحق</span><b>{PRICING_APPENDIX.effective}</b><small>نموذج الغسلات الشهرية</small></div>
    </div>

    <div className="sp-calc">
      <div className="sp-ch"><Icon n="cash" s={16}/> حاسبة المقابل الشهري التقديري</div>
      <div className="sp-inputs">
        <label><span>متوسط الطلبات / بايكر / شهر</span><input type="number" min="0" value={orders} onChange={e=>setOrders(Math.max(0,Number(e.target.value||0)))}/></label>
        <label><span>عدد البايكرز</span><input type="number" min="1" value={bikers} onChange={e=>setBikers(Math.max(1,Number(e.target.value||0)))}/></label>
      </div>
      <div className="sp-range"><input type="range" min="0" max="360" step="1" value={orders} onChange={e=>setOrders(Number(e.target.value))}/></div>

      <div className="sp-out">
        <div className="sp-o"><span>الشريحة المطبَّقة</span><b>{typeof curTier.tier==="number"?"الشريحة "+curTier.tier:curTier.tier}</b></div>
        <div className="sp-o"><span>سعر الطلب في الشريحة</span><b>{money(per.unit)} <small>({money(per.unitVat)} شامل)</small></b></div>
        <div className="sp-o"><span>الطلبات المحتسَبة / بايكر</span><b>{int(per.billableOrders)} {per.billableOrders>per.orders&&<em className="sp-min">مضمون</em>}</b></div>
        <div className="sp-o hi"><span>مقابل البايكر / شهر</span><b>{money(per.total)}</b></div>
        <div className="sp-o hi big"><span>إجمالي {bikers} بايكرز / شهر</span><b>{money(per.total*bikers)}</b></div>
        <div className="sp-o"><span>الإجمالي شامل الضريبة</span><b>{money(per.totalVat*bikers)}</b></div>
      </div>
      <p className="sp-note">تقدير استرشادي وفق ملحق التسعير — يخضع لتحقّق مؤشرات الأداء ومطابقة كشف سويتر الشهري. الحد الأدنى المضمون يُحتسب عند استيفاء شروط العقد.</p>
    </div>

    <div className="sp-tblwrap">
      <div className="sp-ch"><Icon n="reports" s={16}/> جدول شرائح التسعير</div>
      <table className="sp-tbl">
        <thead><tr><th>الشريحة</th><th>متوسط/بايكر/يوم</th><th>السعر</th><th>شامل الضريبة</th><th>الطلبات الشهرية</th></tr></thead>
        <tbody>
          {PRICING_TIERS.map(t=>{const on=t.monthlyOrders===curTier.monthlyOrders;return(
            <tr key={String(t.tier)} className={on?"on":""}>
              <td><b>{typeof t.tier==="number"?t.tier:t.tier}</b></td>
              <td>{t.avgPerDay||"—"}</td>
              <td>{money(t.price)}</td>
              <td>{money(t.priceVat)}</td>
              <td>{int(t.monthlyOrders)}{on&&<span className="sp-here">◄ الحالية</span>}</td>
            </tr>);})}
        </tbody>
      </table>
    </div>

    <div className="sp-terms">
      <div className="sp-ch"><Icon n="doc" s={16}/> مرجع العقد</div>
      <div className="sp-tg">
        <div><span>مدة العقد</span><b>{SSP_CONTRACT.start} → {SSP_CONTRACT.end}</b></div>
        <div><span>مؤشرات الأداء</span><b>تنفيذ ≥{SSP_CONTRACT.sla.orders_fulfilled_pct}% · وصول ≥{SSP_CONTRACT.sla.arrival_pct}%</b></div>
        <div><span>شرط الحافز</span><b>تقييم ≥{SSP_CONTRACT.incentive_conditions.min_rating} · شكاوى ≤{SSP_CONTRACT.incentive_conditions.max_complaints_pct}%</b></div>
        <div><span>الكشف والسداد</span><b>كشف يوم {SSP_CONTRACT.invoice_day} · سداد خلال {SSP_CONTRACT.payment_days} يوم عمل</b></div>
        <div><span>تعديل السعر</span><b>بإشعار {SSP_CONTRACT.price_change_notice_days} يوماً</b></div>
        <div><span>التجديد</span><b>تلقائي ما لم يُخطر قبل {SSP_CONTRACT.renewal_notice_days} يوماً</b></div>
      </div>
    </div>
  </div>);
}

const CSS=`
.sp{--b:#E8712B;color:#0f172a}
.sp *{box-sizing:border-box}
.sp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.sp-kpi{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sp-kl{font-size:11px;color:#64748b;font-weight:700}
.sp-kpi b{display:block;font-size:20px;font-weight:800;margin-top:6px;letter-spacing:-.5px}
.sp-kpi small{font-size:10.5px;color:#94a3b8}
.sp-calc{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px}
.sp-ch{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:12px}
.sp-inputs{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sp-inputs label{display:flex;flex-direction:column;gap:5px}
.sp-inputs span{font-size:11.5px;color:#64748b;font-weight:700}
.sp-inputs input{border:1px solid #e6e9ee;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:15px;font-weight:700;outline:none}
.sp-inputs input:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.sp-range{margin:14px 0 4px}
.sp-range input{width:100%;accent-color:var(--b)}
.sp-out{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
.sp-o{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#f8fafc;border:1px solid #eef1f4;border-radius:11px;padding:11px 13px}
.sp-o span{font-size:12px;color:#64748b;font-weight:600}
.sp-o b{font-size:15px;font-weight:800}.sp-o b small{font-size:11px;color:#64748b;font-weight:600}
.sp-o.hi{background:#fff7f2;border-color:#f5d3b8}
.sp-o.hi.big{grid-column:1/-1;background:linear-gradient(135deg,#E8712B,#f5a35f);border:none}
.sp-o.hi.big span,.sp-o.hi.big b{color:#fff}.sp-o.hi.big b{font-size:22px}
.sp-min{font-style:normal;font-size:10px;font-weight:800;background:#e7f7ef;color:#087443;padding:1px 7px;border-radius:20px;margin-inline-start:6px}
.sp-note{font-size:11px;color:#94a3b8;line-height:1.7;margin:12px 0 0}
.sp-tblwrap,.sp-terms{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px}
.sp-tbl{width:100%;border-collapse:collapse}
.sp-tbl th{font-size:11px;color:#64748b;font-weight:700;text-align:center;padding:9px;border-bottom:1px solid #eceef1;background:#fafbfc}
.sp-tbl td{padding:10px 9px;border-bottom:1px solid #f1f3f5;font-size:12.5px;text-align:center}
.sp-tbl tr:last-child td{border-bottom:none}
.sp-tbl tr.on{background:#fff7f2}
.sp-here{font-size:10px;font-weight:800;color:var(--b);margin-inline-start:6px}
.sp-tg{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-tg>div{display:flex;flex-direction:column;gap:3px;background:#f8fafc;border:1px solid #eef1f4;border-radius:11px;padding:10px 12px}
.sp-tg span{font-size:11px;color:#64748b;font-weight:600}
.sp-tg b{font-size:12.5px;font-weight:800}
@media(max-width:820px){.sp-kpis{grid-template-columns:1fr 1fr}.sp-inputs,.sp-out,.sp-tg{grid-template-columns:1fr}}
`;
