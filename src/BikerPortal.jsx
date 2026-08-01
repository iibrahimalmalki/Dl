import{useState,useEffect}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{SEVERITY,byCode,objectionState}from"./violations";
import{AXES,complianceByAxis,effect as frEffect}from"./fieldChecklist";
import{openReport}from"./fieldReport";

const nowPeriod=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;};
const periodLabel=p=>{const[y,m]=p.split("-");return`${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][+m-1]||m} ${y}`;};
const AR=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const TARGET=200;
const fmtRemain=ms=>{if(ms<=0)return"منتهية";const h=Math.floor(ms/3600000);if(h>=24)return`${Math.floor(h/24)} يوم`;return`${h} ساعة`;};
function standing(r,cpct,fines){
  if(r>=4.75&&cpct<1&&fines===0)return{ar:"متميز",bn:"অসাধারণ",color:"#087443",bg:"#e7f7ef",ic:"star"};
  if(r>=4.5&&cpct<1.5)return{ar:"ممتاز",bn:"চমৎকার",color:"#175cd3",bg:"#eff6ff",ic:"check"};
  if(r>=4.0)return{ar:"جيد",bn:"ভালো",color:"#b54708",bg:"#fef3e2",ic:"performance"};
  return{ar:"يحتاج تحسين",bn:"উন্নতি দরকার",color:"#b42318",bg:"#feecea",ic:"alert"};
}
const STATUS={registered:{ar:"مسجّلة",color:"#b54708",bg:"#fef3e2"},objected:{ar:"معترَض عليها",color:"#175cd3",bg:"#eff6ff"},confirmed:{ar:"مؤكّدة",color:"#b42318",bg:"#feecea"},dismissed:{ar:"مُلغاة",color:"#087443",bg:"#e7f7ef"}};

export default function BikerPortal({me,onLogout}){
  const sid=String(me?.biker_employee_id||"").trim();
  const[period,setPeriod]=useState(nowPeriod());
  const[loading,setLoading]=useState(true);
  const[ops,setOps]=useState(null);const[line,setLine]=useState(null);const[viol,setViol]=useState([]);const[fround,setFround]=useState(null);

  useEffect(()=>{(async()=>{
    setLoading(true);
    const[{data:o},{data:l},{data:v},{data:fr}]=await Promise.all([
      supabase.from("ops_biker_month").select("*").eq("period",period).eq("sweater_id",sid).maybeSingle(),
      supabase.from("payroll_lines").select("*").eq("period",period).eq("biker_id",sid).eq("role","biker").maybeSingle(),
      supabase.from("violations").select("*").eq("period",period).eq("sweater_id",sid).order("logged_at",{ascending:false}),
      supabase.from("field_rounds").select("*").eq("period",period).eq("sweater_id",sid).order("round_date",{ascending:false}).limit(1),
    ]);
    setOps(o||null);setLine(l||null);setViol(v||[]);setFround((fr&&fr[0])||null);setLoading(false);
  })();},[period,sid]);

  const rating=ops?.rating!=null?Number(ops.rating):null;
  const washes=ops?.net_washes||0;const cpct=Number(ops?.complaint_pct||0);
  const fines=viol.filter(v=>v.status==="confirmed").reduce((a,v)=>a+Number(v.fine_applied||0),0);
  const st=standing(rating||0,cpct,fines);
  const c=line?.computed||null;
  const pct=Math.min(Math.round(washes/TARGET*100),100);
  const name=me?.display_name||"البايكر";

  return(<div className="bp">
    <style>{CSS}</style>
    <header className="bp-top">
      <div className="bp-brand"><div className="bp-logo"><Icon n="bucket" s={20}/></div><div><b>دلو ورغوة</b><span>বায়কার পোর্টাল · بوابة البايكر</span></div></div>
      <button className="bp-out" onClick={onLogout}><Icon n="logout" s={18}/></button>
    </header>

    <div className="bp-body">
      <div className="bp-hello">
        <div><div className="bp-hi">أهلاً {name} 👋</div><div className="bp-hi-s">স্বাগতম · #{sid||"—"}</div></div>
        <label className="bp-month"><Icon n="calendar" s={15}/><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
      </div>

      {loading?<div className="dw-skel" style={{height:200,borderRadius:18}}/>:
      (!ops&&!line&&viol.length===0&&!fround)?<div className="bp-empty"><div className="bp-empty-ic"><Icon n="performance" s={30}/></div><h3>لا بيانات بعد لـ{periodLabel(period)}</h3><p>ستظهر نتيجتك بعد إصدار تقرير الشهر · এই মাসের রিপোর্ট প্রকাশের পর দেখা যাবে।</p></div>:
      <>
        {/* التقييم والحالة */}
        <div className="bp-hero">
          <div className="bp-hero-top">
            <div><div className="bp-lbl">تقييمك · রেটিং</div><div className="bp-rate">{rating!=null?rating.toFixed(2):"—"}<i>/5</i></div></div>
            <span className="bp-stand" style={{background:st.bg,color:st.color}}><Icon n={st.ic} s={14}/> {st.ar} · {st.bn}</span>
          </div>
          <div className="bp-track"><div style={{width:pct+"%",background:pct>=100?"#12b76a":pct>=75?"#E8712B":"#f79009"}}/></div>
          <div className="bp-track-l">{washes} من {TARGET} غسلة · {pct}% · {washes} ওয়াশ</div>
        </div>

        {/* المكافأة */}
        <div className="bp-card">
          <div className="bp-c-h"><Icon n="payroll" s={16}/> مكافأتك · পুরস্কার</div>
          {c?<>
            <div className="bp-reward">{AR(c.net_bonus)}<i>ريال</i></div>
            <div className="bp-sub">صافي المكافأة المحوّلة · স্থানান্তরিত পুরস্কার</div>
            <div className="bp-break">
              <B t="ثابت (2×غسلة)" v={c.fixed}/>
              <B t="جودة" v={c.quality}/>
              <B t="سلامة" v={c.safety}/>
              {c.tips>0&&<B t="إكراميات" v={c.tips}/>}
              {c.production>0&&<B t="مكافأة إنتاج" v={c.production} good/>}
              {c.deductions>0&&<B t="استقطاعات" v={-c.deductions} bad/>}
            </div>
            <div className="bp-rate-note">المعدل: {c.rate_per_wash?.toFixed?.(2)||c.rate_per_wash} ريال/غسلة · প্রতি ওয়াশ</div>
          </>:<div className="bp-pending">لم تُحتسب المكافأة بعد لهذا الشهر · এখনও গণনা হয়নি</div>}
        </div>

        {/* الشكاوى ضده */}
        <div className="bp-card">
          <div className="bp-c-h"><Icon n="complaints" s={16}/> الشكاوى ضدك · অভিযোগ <span className="bp-count">{viol.length}</span></div>
          {viol.length===0?<div className="bp-clean"><Icon n="check" s={16}/> لا مخالفات هذا الشهر · কোনো লঙ্ঘন নেই 🎉</div>:
          <>
            {viol.map(v=>{const cat=byCode(v.code)||{};const sev=SEVERITY[v.severity]||SEVERITY.low;const os=objectionState(v.logged_at,v.win_hours);const s=STATUS[v.status]||STATUS.registered;return(
              <div className="bp-v" key={v.id} style={{borderInlineStartColor:sev.color}}>
                <div className="bp-v-top"><div className="bp-v-t"><span className="bp-code" style={{background:sev.bg,color:sev.color}}>{v.code}</span>{cat.ar}</div><div className="bp-v-fine">{AR(v.fine_applied)}<i>ر</i></div></div>
                <div className="bp-v-meta"><span className="bp-chip" style={{background:sev.bg,color:sev.color}}>{sev.ar}</span><span className="bp-chip" style={{background:s.bg,color:s.color}}>{s.ar}</span><span className="bp-v-date">{new Date(v.logged_at).toLocaleDateString("en-GB")}</span></div>
                {!os.none&&os.open&&<div className="bp-obj"><Icon n="clock" s={12}/> يمكنك الاعتراض خلال {fmtRemain(os.remainingMs)} · আপিল করুন</div>}
              </div>);})}
            <div className="bp-obj-note"><Icon n="alert" s={12}/> للاعتراض: راجع المشرف بدليل كتابي خلال 48 ساعة من التسجيل. · আপিলের জন্য সুপারভাইজারের সাথে যোগাযোগ করুন।</div>
          </>}
        </div>

        {/* الالتزام الميداني */}
        {fround&&(()=>{const cp=fround.compliance_pct;const ef=frEffect(cp);const ax=fround.by_axis||complianceByAxis(fround.results||{});return(
        <div className="bp-card">
          <div className="bp-c-h"><Icon n="rounds" s={16}/> الالتزام الميداني · মাঠ পরিদর্শন</div>
          <div className="bp-fr-top">
            <div className="bp-fr-pct" style={{color:ef.color}}>{cp!=null?cp+"%":"—"}</div>
            <span className="bp-fr-eff" style={{background:ef.bg,color:ef.color}}>{ef.ar}</span>
          </div>
          <div className="bp-fr-axes">
            {Object.entries(AXES).map(([k,m])=>{const a=ax[k]||{};const col=a.pct==null?"#cbd5e1":a.pct>=80?"#12b76a":a.pct>=60?"#f79009":"#f04438";return(
              <div className="bp-fr-ax" key={k}><div className="bp-fr-ax-h"><span>{m.ar}</span><b style={{color:col}}>{a.pct!=null?a.pct+"%":"—"}</b></div><div className="bp-fr-t"><div style={{width:(a.pct==null?0:Math.max(a.pct,3))+"%",background:col}}/></div></div>);})}
          </div>
          <button className="bp-fr-btn" onClick={()=>openReport(fround,fround.ai_analysis,"دلو ورغوة")}><Icon n="print" s={14}/> عرض تقرير الجولة · রিপোর্ট</button>
          <div className="bp-fr-date">جولة {fround.round_date}{fround.inspector?" · "+fround.inspector:""}</div>
        </div>);})()}

        {/* أداء مختصر */}
        <div className="bp-card">
          <div className="bp-c-h"><Icon n="performance" s={16}/> أداؤك · পারফরম্যান্স</div>
          <div className="bp-metrics">
            <M t="غسلات صافية" v={washes}/>
            <M t="نسبة الشكاوى" v={cpct+"%"} tone={cpct<1?"g":cpct<2?"a":"r"}/>
            <M t="شكاوى معتمدة" v={ops?.approved_complaints||0} tone={(ops?.approved_complaints||0)?"r":"g"}/>
            <M t="غرامات" v={AR(fines)} tone={fines?"r":"g"}/>
          </div>
        </div>
      </>}
      <div className="bp-foot">دلو ورغوة × سويتر · تحديث تلقائي من تقارير الشهر</div>
    </div>
  </div>);
}
function B({t,v,good,bad}){return(<div className="bp-b"><span>{t}</span><b style={{color:bad?"#b42318":good?"#087443":"#0f172a"}}>{v<0?"−":""}{AR(Math.abs(v))}</b></div>);}
function M({t,v,tone}){const c=tone==="g"?"#087443":tone==="a"?"#b54708":tone==="r"?"#b42318":"#0f172a";return(<div className="bp-m"><div className="bp-m-v" style={{color:c}}>{v}</div><div className="bp-m-t">{t}</div></div>);}

const CSS=`
.bp{min-height:100dvh;background:#f4f5f7;font-family:'Segoe UI',Tahoma,system-ui,sans-serif;direction:rtl;color:#0f172a}
.bp *{box-sizing:border-box}
.bp-top{background:#0e1622;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.bp-brand{display:flex;align-items:center;gap:11px}
.bp-logo{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#E8712B,#f5a35f);display:flex;align-items:center;justify-content:center;color:#fff}
.bp-brand b{font-size:14.5px;font-weight:800;display:block}.bp-brand span{font-size:10.5px;color:#8794a8}
.bp-out{width:38px;height:38px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.bp-body{max-width:480px;margin:0 auto;padding:16px}
.bp-hello{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.bp-hi{font-size:17px;font-weight:800}.bp-hi-s{font-size:11.5px;color:#94a3b8}
.bp-month{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:7px 10px;color:#64748b}
.bp-month input{border:none;outline:none;font-family:inherit;font-size:12.5px;font-weight:700;color:#0f172a;background:none;width:118px}
.bp-hero{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border-radius:18px;padding:18px;margin-bottom:12px}
.bp-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:16px}
.bp-lbl{font-size:11px;color:#94a3b8;font-weight:600}
.bp-rate{font-size:38px;font-weight:800;letter-spacing:-1px;line-height:1}.bp-rate i{font-size:14px;color:#94a3b8;font-weight:600;font-style:normal;margin-inline-start:3px}
.bp-stand{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:800}
.bp-track{height:9px;background:rgba(255,255,255,.14);border-radius:6px;overflow:hidden}
.bp-track div{height:100%;border-radius:6px;transition:width .4s}
.bp-track-l{font-size:11px;color:#cbd5e1;margin-top:7px;font-weight:600}
.bp-card{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:15px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.bp-c-h{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;margin-bottom:12px}
.bp-count,.bp-c-h .bp-count{margin-inline-start:auto;background:#fef3e2;color:#b54708;font-size:11px;font-weight:800;padding:1px 9px;border-radius:20px}
.bp-reward{font-size:30px;font-weight:800;color:#087443;letter-spacing:-.5px}.bp-reward i{font-size:13px;color:#94a3b8;font-weight:600;font-style:normal;margin-inline-start:4px}
.bp-sub{font-size:11px;color:#94a3b8;margin-bottom:12px}
.bp-break{display:flex;flex-direction:column;gap:2px;border-top:1px solid #f1f3f5;padding-top:10px}
.bp-b{display:flex;align-items:center;justify-content:space-between;padding:5px 0;font-size:12.5px}
.bp-b span{color:#64748b}.bp-b b{font-weight:800}
.bp-rate-note{margin-top:8px;font-size:11px;color:#94a3b8;text-align:center;background:#fafbfc;border-radius:8px;padding:6px}
.bp-pending{color:#94a3b8;font-size:12.5px;text-align:center;padding:14px}
.bp-clean{display:flex;align-items:center;justify-content:center;gap:7px;color:#087443;font-weight:700;font-size:13px;padding:14px;background:#f6fdf9;border-radius:11px}
.bp-v{background:#fff;border:1px solid #f1f3f5;border-inline-start:3px solid #ccc;border-radius:11px;padding:11px 12px;margin-bottom:8px}
.bp-v-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.bp-v-t{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#0f172a}
.bp-code{width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none}
.bp-v-fine{font-size:15px;font-weight:800;color:#b42318;flex:none}.bp-v-fine i{font-size:10px;color:#94a3b8;font-weight:600;font-style:normal}
.bp-v-meta{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
.bp-chip{padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700}
.bp-v-date{font-size:10.5px;color:#94a3b8;margin-inline-start:auto}
.bp-obj{display:flex;align-items:center;gap:5px;margin-top:8px;font-size:11px;color:#175cd3;font-weight:700;background:#eff6ff;border-radius:8px;padding:6px 9px}
.bp-obj-note{display:flex;align-items:flex-start;gap:6px;margin-top:10px;font-size:10.5px;color:#92600e;background:#fffbeb;border:1px solid #fde9c8;border-radius:9px;padding:8px 10px;line-height:1.6}
.bp-fr-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.bp-fr-pct{font-size:30px;font-weight:800;letter-spacing:-.5px;line-height:1}
.bp-fr-eff{font-size:11px;font-weight:800;padding:5px 11px;border-radius:20px}
.bp-fr-axes{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.bp-fr-ax-h{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px}
.bp-fr-ax-h b{font-size:12px}
.bp-fr-t{height:6px;background:#eef0f3;border-radius:5px;overflow:hidden}.bp-fr-t div{height:100%;border-radius:5px}
.bp-fr-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px;border:1px solid #ffd9bd;background:#fff7f0;color:#b54708;border-radius:11px;font-family:inherit;font-weight:800;font-size:12.5px;cursor:pointer}
.bp-fr-btn:hover{background:#fff2e8}
.bp-fr-date{text-align:center;font-size:10.5px;color:#94a3b8;margin-top:8px}
.bp-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bp-m{background:#fafbfc;border:1px solid #f1f3f5;border-radius:11px;padding:11px;text-align:center}
.bp-m-v{font-size:17px;font-weight:800}.bp-m-t{font-size:10.5px;color:#64748b;font-weight:600;margin-top:2px}
.bp-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:18px;padding:40px 24px;text-align:center}
.bp-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#175cd3}
.bp-empty h3{font-size:16px;margin:0 0 8px}.bp-empty p{color:#64748b;font-size:12.5px;line-height:1.7;margin:0}
.bp-foot{text-align:center;color:#b6bfcc;font-size:10.5px;padding:18px 0 8px}
`;
