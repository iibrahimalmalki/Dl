import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import ActivityLog from"./ActivityLog";
const CU_FL={name:"العهدة",status:"الحالة",start_date:"البداية",end_date:"النهاية",biker_name:"البايكر",sweater_id:"رقم البايكر",life_months:"العمر (شهر)",category:"الفئة"};
const CU_DV={active:"نشطة",due:"مستحقة",replaced:"مُستبدلة",returned:"مُرجعة",planned:"مخطّطة"};

// كتالوج عُهد سويتر (Biker Tools) — العمر الافتراضي بالأشهر ومهلة التخطيط بالأيام
// mode: buy (دراجة → تخطيط شراء) · replace (أصل معمّر → استبدال) · reorder (مستهلك → طلب سويتر)
export const CATALOG=[
  {key:"moto",name:"الدراجة النارية",en:"Motorcycle",type:"motorcycle",category:"مركبة",life:36,lead:90,mode:"buy"},
  {key:"uniform",name:"الزي الرسمي",en:"Official Uniform",type:"uniform",category:"زي",life:12,lead:45,mode:"replace"},
  {key:"helmet",name:"الخوذة",en:"Helmet",type:"safety",category:"معدات حماية",life:24,lead:60,mode:"replace"},
  {key:"chest",name:"الصدرية (واقي الصدر)",en:"Safety Chest",type:"safety",category:"معدات حماية",life:24,lead:60,mode:"replace"},
  {key:"handsleg",name:"واقي اليدين والأرجل",en:"Safety Hands & Legs",type:"safety",category:"معدات حماية",life:24,lead:60,mode:"replace"},
  {key:"shoes",name:"حذاء السلامة",en:"Safety Shoes",type:"safety",category:"معدات حماية",life:12,lead:45,mode:"replace"},
  {key:"vacuum",name:"المكنسة",en:"Vacuum Cleaner",type:"tool",category:"أدوات",life:18,lead:45,mode:"replace"},
  {key:"watergun",name:"مسدس الماء",en:"Water Gun",type:"tool",category:"أدوات",life:12,lead:30,mode:"replace"},
  {key:"watermotor",name:"موتور الماء",en:"Water Motor",type:"tool",category:"أدوات",life:18,lead:45,mode:"replace"},
  {key:"headlight",name:"كشّاف الرأس",en:"Headlight",type:"tool",category:"أدوات",life:12,lead:30,mode:"replace"},
  {key:"servicebox",name:"صندوق الخدمة",en:"Service Box",type:"tool",category:"أدوات",life:24,lead:45,mode:"replace"},
  {key:"brushes",name:"الفرش (إطارات/مكيّف/أرضية/صغيرة)",en:"Brushes set",type:"tool",category:"أدوات",life:6,lead:14,mode:"replace"},
  {key:"dash",name:"ملمّع الدَّشبورد",en:"Dashboard Polish",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"tyrepol",name:"ملمّع الإطارات",en:"Tyre Polish",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"stain",name:"مزيل البقع",en:"Stain Remover",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"lasttouch",name:"اللمسة الأخيرة",en:"Last Touch",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"glass",name:"منظّف الزجاج",en:"Glass Cleaner",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"soap",name:"صابون/شامبو",en:"Soap/Shampoo",type:"cleaning",category:"مواد تنظيف",life:1,lead:7,mode:"reorder"},
  {key:"sponge",name:"إسفنجات (بودي/إطارات)",en:"Sponges",type:"sponge",category:"مستهلكات",life:2,lead:7,mode:"reorder"},
  {key:"towels",name:"مناشف ميكروفايبر (4 ألوان)",en:"Microfiber towels",type:"towel",category:"مستهلكات",life:2,lead:7,mode:"reorder"},
];
const MODE_OF=t=>t==="motorcycle"?"buy":["cleaning","sponge","towel","consumable"].includes(t)?"reorder":"replace";
const addMonths=(iso,m)=>{const d=new Date(iso);d.setMonth(d.getMonth()+Math.round(m));return d.toISOString().slice(0,10);};
const daysBetween=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const today=()=>new Date().toISOString().slice(0,10);

export default function Custody({opId,owner}){
  const[rows,setRows]=useState([]);const[emps,setEmps]=useState([]);const[loading,setLoading]=useState(true);
  const[msg,setMsg]=useState(null);const[tab,setTab]=useState("all");
  const[showAdd,setShowAdd]=useState(false);const[showExtract,setShowExtract]=useState(false);
  const[rounds,setRounds]=useState([]);const[exRound,setExRound]=useState("");
  const[f,setF]=useState({sweater_id:"",catKey:"moto",name:"",start_date:today(),life_months:36,lead_days:90,cost:""});

  useEffect(()=>{(async()=>{
    setLoading(true);
    const[{data:e},ca]=await Promise.all([
      supabase.from("employees").select("id,full_name,employee_id").not("employee_id","is",null).order("employee_id"),
      (()=>{let q=supabase.from("custody_assets").select("*").order("end_date",{ascending:true});if(opId&&opId!=="all")q=q.eq("operator_id",opId);return q;})(),
    ]);
    setEmps(e||[]);setRows(ca.data||[]);setLoading(false);
  })();},[opId]);

  const empBySid=useMemo(()=>{const m={};emps.forEach(x=>{if(x.employee_id)m[String(x.employee_id).trim()]=x;});return m;},[emps]);
  const dep=r=>{const life=(r.life_months||12)*30;const age=Math.max(0,daysBetween(r.start_date,today()));const end=r.end_date||addMonths(r.start_date,r.life_months||12);const rem=daysBetween(today(),end);const used=Math.min(100,Math.max(0,Math.round(age/life*100)));const due=r.status!=="replaced"&&r.status!=="returned"&&rem<=(r.lead_days||60);return{age,rem,used,end,due};};
  const shown=useMemo(()=>{
    let a=rows;if(tab==="due")a=rows.filter(r=>dep(r).due&&r.status!=="replaced"&&r.status!=="returned");
    else if(tab==="active")a=rows.filter(r=>r.status==="active"||r.status==="due");
    else if(tab==="reorder")a=rows.filter(r=>MODE_OF(r.item_type)==="reorder");
    return a;
  },[rows,tab]);
  const kpis=useMemo(()=>{const due=rows.filter(r=>dep(r).due&&r.status!=="replaced"&&r.status!=="returned");return{
    total:rows.length,due:due.length,
    buy:due.filter(r=>MODE_OF(r.item_type)==="buy").length,
    reorder:due.filter(r=>MODE_OF(r.item_type)==="reorder").length,
  };},[rows]);

  const pickCat=k=>{const c=CATALOG.find(x=>x.key===k);setF(p=>({...p,catKey:k,name:c?c.name:"",life_months:c?c.life:12,lead_days:c?c.lead:60}));};
  const addCustody=async()=>{
    if(!f.sweater_id){setMsg({ok:false,t:"اختر البايكر"});return;}
    const c=CATALOG.find(x=>x.key===f.catKey);const emp=empBySid[String(f.sweater_id).trim()];
    const row={operator_id:(opId&&opId!=="all")?opId:null,employee_id:emp?.id||null,biker_name:emp?.full_name||"",sweater_id:f.sweater_id,
      item_type:c?.type||"other",category:c?.category||null,name:f.name||c?.name||"عُهدة",name_en:c?.en||null,
      start_date:f.start_date,life_months:Number(f.life_months||12),end_date:addMonths(f.start_date,Number(f.life_months||12)),
      lead_days:Number(f.lead_days||60),cost:f.cost?Number(f.cost):null,source:"manual"};
    const{data,error}=await supabase.from("custody_assets").insert(row).select().single();
    if(error){setMsg({ok:false,t:"خطأ: "+error.message});return;}
    setRows(p=>[...p,data].sort((a,b)=>(a.end_date||"")<(b.end_date||"")?-1:1));setShowAdd(false);setMsg({ok:true,t:"تمت إضافة العُهدة"});
  };

  const extractFromRound=async()=>{
    const r=rounds.find(x=>x.id===exRound);if(!r){setMsg({ok:false,t:"اختر جولة"});return;}
    const emp=empBySid[String(r.sweater_id).trim()];
    const existing=new Set(rows.filter(x=>String(x.sweater_id)===String(r.sweater_id)&&x.status!=="replaced"&&x.status!=="returned").map(x=>x.name));
    const toAdd=CATALOG.filter(c=>!existing.has(c.name)).map(c=>({operator_id:(opId&&opId!=="all")?opId:null,employee_id:emp?.id||null,biker_name:emp?.full_name||r.biker_name||"",sweater_id:r.sweater_id,
      item_type:c.type,category:c.category,name:c.name,name_en:c.en,start_date:r.round_date,life_months:c.life,end_date:addMonths(r.round_date,c.life),lead_days:c.lead,source:"round",round_id:r.id}));
    if(!toAdd.length){setMsg({ok:false,t:"كل عُهد الكتالوج مسجّلة لهذا البايكر"});setShowExtract(false);return;}
    const{data,error}=await supabase.from("custody_assets").insert(toAdd).select();
    if(error){setMsg({ok:false,t:"خطأ: "+error.message});return;}
    setRows(p=>[...p,...(data||[])].sort((a,b)=>(a.end_date||"")<(b.end_date||"")?-1:1));setShowExtract(false);setExRound("");
    setMsg({ok:true,t:`تمت إضافة ${data?.length||0} عُهدة من الجولة (بداية ${r.round_date})`});
  };
  const openExtract=async()=>{
    setShowExtract(true);setShowAdd(false);
    let q=supabase.from("field_rounds").select("id,biker_name,sweater_id,round_date").order("round_date",{ascending:false}).limit(40);
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data}=await q;setRounds(data||[]);
  };

  const reorder=async(r)=>{ // مستهلك → طلب سويتر + إعادة ضبط دورة الإهلاك
    const p=n=>String(n).padStart(2,"0");const d=new Date();
    const ref=`DW-${r.sweater_id||"x"}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-C${Math.floor(1000+Math.random()*9000)}`;
    const item={n:null,ar:r.name,en:r.name_en||"",type:r.item_type,category:r.category||"مستهلكات",category_en:"",status:"reorder",status_ar:"إعادة طلب (استهلاك دورة العُهدة)",status_en:"Reorder (consumable cycle)",note:`عُهدة بدأت ${r.start_date} — انتهت دورتها`,parts_ar:"",parts_en:""};
    const{data:sr,error}=await supabase.from("supply_requests").insert({operator_id:r.operator_id,ref,round_id:r.round_id||null,biker_name:r.biker_name,sweater_id:r.sweater_id,requesting_dept:"التشغيل — دلو ورغوة",items:[item]}).select().single();
    if(error){setMsg({ok:false,t:"خطأ في إنشاء الطلب: "+error.message});return;}
    // إعادة ضبط دورة العُهدة المستهلكة
    const ns=today(),ne=addMonths(ns,r.life_months||1);
    const{data:up}=await supabase.from("custody_assets").update({start_date:ns,end_date:ne,status:"active",reorder_request_id:sr.id}).eq("id",r.id).select().single();
    if(up)setRows(pr=>pr.map(x=>x.id===r.id?up:x));
    setMsg({ok:true,t:`أُنشئ طلب سويتر ${ref} وأُعيدت دورة العُهدة — راجع «طلبات الإمداد»`});
  };
  const planReplace=async(r)=>{ // أصل معمّر/دراجة → وسم للتخطيط
    const{data}=await supabase.from("custody_assets").update({status:"due",notes:(r.notes?r.notes+" · ":"")+`خُطّط للاستبدال ${today()}`}).eq("id",r.id).select().single();
    if(data)setRows(p=>p.map(x=>x.id===r.id?data:x));
    setMsg({ok:true,t:r.item_type==="motorcycle"?"وُسمت الدراجة ضمن خطة الشراء":"وُسمت العُهدة للاستبدال"});
  };
  const markReplaced=async(r)=>{const{data}=await supabase.from("custody_assets").update({status:"replaced"}).eq("id",r.id).select().single();if(data)setRows(p=>p.map(x=>x.id===r.id?data:x));};
  const del=async(r)=>{if(!confirm("حذف العُهدة؟"))return;const{error}=await supabase.from("custody_assets").delete().eq("id",r.id);if(!error)setRows(p=>p.filter(x=>x.id!==r.id));};

  if(loading)return<div className="dw-skel" style={{height:280}}/>;

  return(<div className="cu">
    <style>{CSS}</style>
    <div className="cu-bar">
      <button className="cu-btn" onClick={()=>{setShowAdd(!showAdd);setShowExtract(false);setMsg(null);}}><Icon n="plus" s={15}/> إضافة عُهدة</button>
      <button className="cu-btn ghost" onClick={openExtract}><Icon n="rounds" s={15}/> استخراج من جولة</button>
    </div>
    {msg&&<div className={"cu-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

    {showAdd&&<div className="cu-form">
      <div className="cu-grid">
        <label><span>البايكر</span><select value={f.sweater_id} onChange={e=>setF({...f,sweater_id:e.target.value})}><option value="">اختر…</option>{emps.map(e=><option key={e.id} value={e.employee_id}>{e.full_name} · #{e.employee_id}</option>)}</select></label>
        <label><span>العُهدة</span><select value={f.catKey} onChange={e=>pickCat(e.target.value)}>{CATALOG.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
        <label><span>تاريخ البداية</span><input type="date" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})}/></label>
        <label><span>العمر الافتراضي (شهر)</span><input type="number" min="1" value={f.life_months} onChange={e=>setF({...f,life_months:e.target.value})}/></label>
        <label><span>مهلة التخطيط (يوم)</span><input type="number" min="1" value={f.lead_days} onChange={e=>setF({...f,lead_days:e.target.value})}/></label>
        <label><span>التكلفة (اختياري)</span><input type="number" value={f.cost} onChange={e=>setF({...f,cost:e.target.value})}/></label>
      </div>
      <div className="cu-endhint">تاريخ الانتهاء المتوقّع: <b>{f.start_date?addMonths(f.start_date,Number(f.life_months||12)):"—"}</b></div>
      <button className="cu-btn ok" style={{width:"100%",marginTop:10}} onClick={addCustody}><Icon n="save" s={15}/> حفظ العُهدة</button>
    </div>}

    {showExtract&&<div className="cu-form">
      <div className="cu-fh"><Icon n="rounds" s={15}/> استخراج عُهد الكتالوج من جولة ميدانية (تاريخ البداية = تاريخ الجولة)</div>
      <div className="cu-exrow">
        <select value={exRound} onChange={e=>setExRound(e.target.value)}><option value="">اختر جولة…</option>{rounds.map(r=><option key={r.id} value={r.id}>{r.biker_name||r.sweater_id} · #{r.sweater_id} · {r.round_date}</option>)}</select>
        <button className="cu-btn ok" onClick={extractFromRound}><Icon n="check" s={15}/> استخراج</button>
      </div>
      <div className="cu-note">يضيف عُهد الكتالوج غير المسجّلة للبايكر (دراجة، زي، معدات حماية، أدوات، مواد تنظيف، مناشف) ببداية تاريخ الجولة وأعمارها الافتراضية — عدّلها بعد الإضافة.</div>
    </div>}

    <div className="cu-kpis">
      <K ic="bucket" c="#175cd3" bg="#eff6ff" t="إجمالي العُهد" v={kpis.total}/>
      <K ic="alert" c="#b54708" bg="#fef3e2" t="قارب انتهاؤها" v={kpis.due}/>
      <K ic="bike" c="#b42318" bg="#feecea" t="تخطيط شراء" v={kpis.buy}/>
      <K ic="refresh" c="#087443" bg="#e7f7ef" t="إعادة طلب" v={kpis.reorder}/>
    </div>
    <div className="cu-hint"><Icon n="alert" s={13}/> يُحسب الإهلاك من تاريخ البداية × العمر الافتراضي. قبل النهاية بمهلة التخطيط: الأصول المعمّرة (الدراجة) → «خطّط للشراء»، والمواد المستهلكة → «طلب سويتر» يُنشئ طلب إمداد ويعيد ضبط دورة العُهدة.</div>

    <div className="cu-tabs">{[["all","الكل"],["due","قارب الانتهاء"],["reorder","المستهلكات"],["active","النشطة"]].map(([k,l])=><button key={k} className={"cu-tab"+(tab===k?" on":"")} onClick={()=>setTab(k)}>{l}</button>)}</div>

    {shown.length===0?<div className="cu-empty"><div className="cu-empty-ic"><Icon n="bucket" s={30}/></div><h3>لا عُهد</h3><p>أضِف عُهدة يدوياً أو استخرجها من جولة ميدانية — ويبدأ احتساب الإهلاك وتخطيط الاستبدال/إعادة الطلب.</p></div>:
    shown.map(r=>{const d=dep(r);const mode=MODE_OF(r.item_type);const col=r.status==="replaced"?"#94a3b8":d.due?"#f04438":d.used>=70?"#f79009":"#12b76a";
      return(
      <div className={"cu-card"+(d.due?" due":"")} key={r.id} style={{borderInlineStartColor:col}}>
        <div className="cu-top">
          <div><div className="cu-name">{r.name}<span className="cu-cat">{r.category}</span>{r.status==="replaced"&&<span className="cu-badge rep">مُستبدلة</span>}{d.due&&r.status!=="replaced"&&<span className="cu-badge due">قارب الانتهاء</span>}</div>
            <div className="cu-sub">{r.biker_name||"—"} · #{r.sweater_id||"—"} · {r.name_en||""}</div></div>
          <div className="cu-rem" style={{color:col}}>{r.status==="replaced"?"—":d.rem>=0?`${d.rem} يوم`:`متأخر ${Math.abs(d.rem)} يوم`}</div>
        </div>
        <div className="cu-dates">🗓️ البداية: <b>{r.start_date}</b> · الانتهاء المتوقّع: <b>{d.end}</b> · العمر: {r.life_months} شهر</div>
        <div className="cu-bar-t"><div style={{width:d.used+"%",background:col}}/></div>
        <div className="cu-used">استُهلك {d.used}% من العمر الافتراضي</div>
        {r.notes&&<div className="cu-notes">{r.notes}</div>}
        <div className="cu-actions">
          {r.status!=="replaced"&&d.due&&mode==="reorder"&&<button className="cu-b reorder" onClick={()=>reorder(r)}><Icon n="refresh" s={13}/> طلب سويتر (إعادة)</button>}
          {r.status!=="replaced"&&d.due&&mode==="buy"&&<button className="cu-b buy" onClick={()=>planReplace(r)}><Icon n="bike" s={13}/> خطّط لشراء دراجة</button>}
          {r.status!=="replaced"&&d.due&&mode==="replace"&&<button className="cu-b plan" onClick={()=>planReplace(r)}><Icon n="alert" s={13}/> خطّط للاستبدال</button>}
          {r.status!=="replaced"&&<button className="cu-b done" onClick={()=>markReplaced(r)}><Icon n="check" s={13}/> استُبدلت</button>}
          <ActivityLog table="custody_assets" rowId={r.id} labels={CU_FL} valueMap={CU_DV} entityName="العهدة"/>
          <div style={{flex:1}}/>
          {owner&&<button className="cu-b del" onClick={()=>del(r)}><Icon n="trash" s={12}/></button>}
        </div>
      </div>);})}
  </div>);
}
function K({ic,c,bg,t,v}){return(<div className="cu-kpi"><span className="cu-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="cu-kv">{v}</div><div className="cu-kl">{t}</div></div></div>);}

const CSS=`
.cu{--b:#E8712B}
.cu-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.cu-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;background:#0f172a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.cu-btn.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.cu-btn.ok{background:linear-gradient(135deg,#12b76a,#087443)}
.cu-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.cu-msg.ok{background:#e7f7ef;color:#087443}.cu-msg.err{background:#feecea;color:#b42318}
.cu-form{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.cu-fh{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;margin-bottom:10px}
.cu-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.cu-grid label{display:flex;flex-direction:column;gap:4px}
.cu-grid span{font-size:11px;color:#64748b;font-weight:600}
.cu-grid select,.cu-grid input{border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;color:#0f172a;outline:none;background:#fff;width:100%;box-sizing:border-box}
.cu-endhint{font-size:11.5px;color:#64748b;margin-top:9px}.cu-endhint b{color:#0f172a}
.cu-exrow{display:flex;gap:8px;flex-wrap:wrap}
.cu-exrow select{flex:1;min-width:180px;border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;outline:none;background:#fff}
.cu-note{font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.6}
.cu-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.cu-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.cu-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.cu-kv{font-size:19px;font-weight:800;letter-spacing:-.5px}.cu-kl{font-size:11px;color:#64748b;font-weight:600}
.cu-hint{display:flex;align-items:flex-start;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:12px;line-height:1.6}
.cu-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.cu-tab{padding:7px 14px;border-radius:20px;border:1px solid #e6e9ee;background:#fff;color:#475569;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}
.cu-tab.on{background:#0f172a;color:#fff;border-color:#0f172a}
.cu-card{background:#fff;border:1px solid #eceef1;border-inline-start:3px solid #ccc;border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.cu-card.due{background:#fffdf9}
.cu-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.cu-name{font-size:14px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cu-cat{font-size:10px;font-weight:700;color:#64748b;background:#f4f5f7;border-radius:20px;padding:2px 9px}
.cu-badge{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:20px}
.cu-badge.due{background:#feecea;color:#b42318}.cu-badge.rep{background:#eef0f3;color:#64748b}
.cu-sub{font-size:11.5px;color:#64748b;margin-top:3px}
.cu-rem{font-size:15px;font-weight:800;flex:none}
.cu-dates{font-size:11px;color:#64748b;margin-top:8px}.cu-dates b{color:#0f172a}
.cu-bar-t{height:7px;background:#eef0f3;border-radius:5px;overflow:hidden;margin-top:7px}.cu-bar-t div{height:100%;border-radius:5px}
.cu-used{font-size:10.5px;color:#94a3b8;margin-top:4px}
.cu-notes{margin-top:8px;font-size:11.5px;color:#475569;background:#fafbfc;border:1px solid #f1f3f5;border-radius:8px;padding:7px 10px}
.cu-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:11px}
.cu-b{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:9px;border:1px solid #e6e9ee;background:#fff;color:#334155;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}
.cu-b.reorder{border-color:#b7e4cd;background:#effaf3;color:#087443}
.cu-b.buy{border-color:#f7bfba;background:#fff5f4;color:#b42318}
.cu-b.plan{border-color:#fbdba7;background:#fffaf0;color:#b54708}
.cu-b.done{border-color:#cfe0f7;background:#f5f9ff;color:#1d5bbf}
.cu-b.del{border-color:#f0d5d2;color:#b42318}
.cu-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.cu-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.cu-empty h3{font-size:16px;margin:0 0 8px}.cu-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.cu-kpis{grid-template-columns:1fr 1fr}.cu-grid{grid-template-columns:1fr 1fr}}
`;
