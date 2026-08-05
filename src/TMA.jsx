import{useState,useEffect,useMemo}from"react";
import{supabase,SITE_URL}from"./supabase";
import Icon from"./Icon";
import{CATS,DRIVES,DRIVE_BY_KEY,TOTAL_DRIVES,TOTAL_TALENTS,interpret,talentOf,completeness,topTalents,categorySummary}from"./tma";
import{TOTAL_ITEMS as Q_TOTAL,answeredCount}from"./tmaQuestionnaire";

const waNum=raw=>{let d=String(raw||"").replace(/[^0-9]/g,"");if(!d)return"";if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("966")||d.startsWith("880"))return d;if(d.startsWith("0"))return(d.length===11?"880":"966")+d.replace(/^0+/,"");if(d.startsWith("5")&&d.length===9)return"966"+d;if(d.startsWith("1")&&d.length===10)return"880"+d;return d;};

export default function TMA({opId,target,onTargetDone}){
  const[tab,setTab]=useState("catalog"); // catalog | assess | invites
  const[list,setList]=useState([]);
  const[invites,setInvites]=useState([]);
  const[emps,setEmps]=useState([]);
  const[loading,setLoading]=useState(true);
  const[invName,setInvName]=useState("");const[invRole,setInvRole]=useState("");
  const[invMsg,setInvMsg]=useState(null);const[invBusy,setInvBusy]=useState(false);

  // نموذج التقييم
  const[recId,setRecId]=useState(null);
  const[name,setName]=useState("");
  const[role,setRole]=useState("");
  const[scores,setScores]=useState({});
  const[notes,setNotes]=useState("");
  const[link,setLink]=useState(null); // {interview_id,applicant_id,source}
  const[saving,setSaving]=useState(false);const[msg,setMsg]=useState(null);
  const[openCat,setOpenCat]=useState(CATS[0].k);

  useEffect(()=>{(async()=>{
    setLoading(true);
    const{data:e}=await supabase.from("employees").select("id,full_name,employee_id").order("created_at",{ascending:false});
    setEmps(e||[]);
    let q=supabase.from("tma_assessments").select("*").order("updated_at",{ascending:false});
    if(opId&&opId!=="all")q=q.eq("operator_id",opId);
    const{data}=await q;setList(data||[]);
    let iq=supabase.from("tma_invites").select("*").order("created_at",{ascending:false});
    if(opId&&opId!=="all")iq=iq.eq("operator_id",opId);
    const{data:iv}=await iq;setInvites(iv||[]);
    setLoading(false);
  })();},[opId]);

  const invLink=id=>`${SITE_URL}?tma=${id}`;
  const createInvite=async(preset)=>{
    const nm=(preset?.name??invName).trim();
    if(!nm){setInvMsg({ok:false,t:"أدخل اسم المرشّح"});return null;}
    setInvBusy(true);setInvMsg(null);
    try{
      const row={operator_id:(opId&&opId!=="all")?opId:null,subject_name:nm,subject_role:(preset?.role??invRole).trim()||null,interview_id:preset?.interview_id||null,applicant_id:preset?.applicant_id||null};
      const{data,error}=await supabase.from("tma_invites").insert(row).select().single();if(error)throw error;
      setInvites(p=>[data,...p]);setInvName("");setInvRole("");
      setInvMsg({ok:true,t:"تم إنشاء رابط الاستبيان — انسخه أو أرسله للمرشّح"});
      setInvBusy(false);return data;
    }catch(e){setInvMsg({ok:false,t:"خطأ: "+(e.message||e)});setInvBusy(false);return null;}
  };
  const copyInv=async(r)=>{try{await navigator.clipboard.writeText(invLink(r.id));setInvMsg({ok:true,t:"تم نسخ الرابط"});}catch{setInvMsg({ok:true,t:invLink(r.id)});}};
  const waInv=(r,phone)=>{const t=`السلام عليكم ${r.subject_name}،\nنرجو تعبئة استبيان المواهب عبر الرابط:\n${invLink(r.id)}\n\nদয়া করে এই লিংকে ব্যক্তিত্ব প্রশ্নাবলী পূরণ করুন।`;window.open(`https://wa.me/${waNum(phone||"")}?text=${encodeURIComponent(t)}`);};
  const delInv=async(r)=>{if(!confirm("حذف رابط استبيان «"+r.subject_name+"»؟"))return;await supabase.from("tma_invites").delete().eq("id",r.id);setInvites(p=>p.filter(x=>x.id!==r.id));};
  const importInv=async(r)=>{
    setInvBusy(true);setInvMsg(null);
    try{
      const row={operator_id:r.operator_id,subject_name:r.subject_name,subject_role:r.subject_role,scores:r.scores||{},notes:"مستورد من استبيان المرشّح الذاتي",interview_id:r.interview_id,applicant_id:r.applicant_id,source:"questionnaire",updated_at:new Date().toISOString()};
      const{data,error}=await supabase.from("tma_assessments").insert(row).select().single();if(error)throw error;
      await supabase.from("tma_invites").update({imported_assessment_id:data.id}).eq("id",r.id);
      setList(p=>[data,...p]);setInvites(p=>p.map(x=>x.id===r.id?{...x,imported_assessment_id:data.id}:x));
      setInvMsg({ok:true,t:"تم استيراد النتائج إلى ملف مواهب — افتحه من تبويب التقييمات"});
    }catch(e){setInvMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setInvBusy(false);
  };

  // قدوم من شاشة المقابلات: افتح ملف المرشح الموجود أو ابدأ ملفاً جديداً مربوطاً بالمقابلة
  useEffect(()=>{
    if(!target||loading)return;
    const ex=list.find(r=>(target.interview_id&&r.interview_id===target.interview_id)||(target.applicant_id&&r.applicant_id===target.applicant_id));
    if(ex){openRec(ex);}
    else{
      setRecId(null);setScores({});setNotes("");setMsg(null);
      setName(target.name||"");setRole(target.role||"");
      setLink({interview_id:target.interview_id||null,applicant_id:target.applicant_id||null,source:target.source||"interview"});
      setTab("assess");
    }
    onTargetDone&&onTargetDone();
  // eslint-disable-next-line
  },[target,loading]);

  const reset=()=>{setRecId(null);setName("");setRole("");setScores({});setNotes("");setLink(null);setMsg(null);};
  const openRec=r=>{setRecId(r.id);setName(r.subject_name||"");setRole(r.subject_role||"");setScores(r.scores||{});setNotes(r.notes||"");setLink(r.interview_id||r.applicant_id?{interview_id:r.interview_id,applicant_id:r.applicant_id,source:r.source}:null);setMsg(null);setTab("assess");};
  const setScore=(k,v)=>setScores(p=>({...p,[k]:Number(v)}));

  const comp=useMemo(()=>completeness(scores),[scores]);
  const top=useMemo(()=>topTalents(scores,6),[scores]);
  const catSum=useMemo(()=>categorySummary(scores),[scores]);

  const save=async()=>{
    if(!name.trim()){setMsg({ok:false,t:"أدخل اسم الشخص المُقيَّم"});return;}
    setSaving(true);setMsg(null);
    try{
      const row={operator_id:(opId&&opId!=="all")?opId:null,subject_name:name.trim(),subject_role:role.trim()||null,scores,notes:notes.trim()||null,interview_id:link?.interview_id||null,applicant_id:link?.applicant_id||null,source:link?.source||"manual",updated_at:new Date().toISOString()};
      let saved;
      if(recId){const{data,error}=await supabase.from("tma_assessments").update(row).eq("id",recId).select().single();if(error)throw error;saved=data;}
      else{const{data,error}=await supabase.from("tma_assessments").insert(row).select().single();if(error)throw error;saved=data;setRecId(data.id);}
      setList(p=>[saved,...p.filter(x=>x.id!==saved.id)]);
      setMsg({ok:true,t:"تم حفظ ملف المواهب ("+comp.done+"/"+TOTAL_DRIVES+" محرك)"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setSaving(false);
  };
  const del=async(r)=>{
    if(!confirm("حذف ملف مواهب «"+r.subject_name+"»؟"))return;
    await supabase.from("tma_assessments").delete().eq("id",r.id);
    setList(p=>p.filter(x=>x.id!==r.id));
    if(recId===r.id)reset();
  };

  if(loading)return <div className="dw-skel" style={{height:280}}/>;

  return(<div className="tm">
    <style>{CSS}</style>

    <div className="tm-note"><Icon n="lock" s={13}/> وحدة مقصورة على المالك — بيانات المواهب معزولة تماماً عن الرواتب والشكاوى ولا تُمنح كصلاحية.</div>

    <div className="tm-tabs">
      <button className={tab==="catalog"?"on":""} onClick={()=>setTab("catalog")}><Icon n="tma" s={15}/> الكتالوج المرجعي</button>
      <button className={tab==="assess"?"on":""} onClick={()=>setTab("assess")}><Icon n="edit" s={15}/> التقييمات <span className="tm-cnt">{list.length}</span></button>
      <button className={tab==="invites"?"on":""} onClick={()=>setTab("invites")}><Icon n="phone" s={15}/> استبيان المرشّح <span className="tm-cnt">{invites.length}</span></button>
    </div>

    {tab==="invites"?
    <div className="tm-inv">
      <div className="tm-inv-new">
        <div className="tm-inv-h"><Icon n="link" s={15}/> إرسال استبيان لمرشّح جديد</div>
        <p className="tm-inv-desc">يجيب المرشّح على {Q_TOTAL} عبارة (عربي + بنغالي) عبر رابط سهل، ثم تستورد النتيجة إلى ملف مواهبه — تقييم ذاتي أقلّ تحيّزاً من الحكم اليدوي.</p>
        <div className="tm-frow">
          <label className="tm-field"><span>اسم المرشّح</span><input value={invName} onChange={e=>setInvName(e.target.value)} placeholder="الاسم الكامل"/></label>
          <label className="tm-field"><span>الدور</span><input value={invRole} onChange={e=>setInvRole(e.target.value)} placeholder="مرشّح للتوظيف"/></label>
        </div>
        <button className="tm-save" onClick={()=>createInvite()} disabled={invBusy}><Icon n="plus" s={15}/> {invBusy?"…":"إنشاء رابط الاستبيان"}</button>
        {invMsg&&<div className={"tm-msg "+(invMsg.ok?"ok":"err")} style={{marginTop:10,marginBottom:0}}>{invMsg.t}</div>}
      </div>

      <div className="tm-saved-h" style={{marginTop:18}}><Icon n="inbox" s={15}/> الروابط المُرسَلة <span>({invites.length})</span></div>
      {invites.length===0?<div className="tm-empty"><div className="tm-empty-ic"><Icon n="phone" s={28}/></div><h3>لا روابط بعد</h3><p>أنشئ رابط استبيان أعلاه وأرسله للمرشّح عبر واتساب.</p></div>:
      <div className="tm-inv-list">{invites.map(r=>{const cp=r.status==="completed";const tt=cp?topTalents(r.scores||{},4):[];const ac=answeredCount(r.answers||{});return(
        <div className="tm-inv-card" key={r.id}>
          <div className="tm-inv-top">
            <div className="tm-inv-av">{(r.subject_name||"?").trim().charAt(0)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="tm-inv-name">{r.subject_name}{r.subject_role&&<small>{r.subject_role}</small>}</div>
              <div className="tm-inv-st">{cp?<span className="tm-inv-badge done"><Icon n="check" s={11}/> مكتمل</span>:<span className="tm-inv-badge">{ac}/{Q_TOTAL} · بانتظار الإجابة</span>}{r.interview_id&&<span className="tm-inv-tagx"><Icon n="interview" s={10}/> من مقابلة</span>}</div>
            </div>
          </div>
          {cp&&tt.length>0&&<div className="tm-card-tags" style={{margin:"4px 0 10px"}}>{tt.map((x,idx)=><span key={idx} className={"tm-mini "+(x.talent.side==="a"?"a":"b")}>{x.talent.n}</span>)}</div>}
          <div className="tm-inv-act">
            {!cp&&<><button onClick={()=>copyInv(r)}><Icon n="link" s={13}/> نسخ</button><button onClick={()=>waInv(r)}><Icon n="phone" s={13}/> واتساب</button></>}
            {cp&&(r.imported_assessment_id?<span className="tm-inv-imp"><Icon n="check" s={12}/> مُستورد إلى ملف مواهب</span>:<button className="imp" onClick={()=>importInv(r)} disabled={invBusy}><Icon n="download" s={13}/> استيراد النتائج</button>)}
            <button className="del" onClick={()=>delInv(r)}><Icon n="trash" s={13}/></button>
          </div>
        </div>);})}</div>}
    </div>
    :tab==="catalog"?<Catalog/>:
    <div className="tm-assess">
      {/* لوحة الإدخال */}
      <div className="tm-form">
        <div className="tm-form-h">
          <b>{recId?"تعديل ملف مواهب":"ملف مواهب جديد"}</b>
          {recId&&<button className="tm-new" onClick={reset}><Icon n="plus" s={13}/> جديد</button>}
        </div>
        {link?.interview_id&&<div className="tm-link"><Icon n="interview" s={13}/> ملف مرتبط بمقابلة مرشّح — جزء من مسار التوظيف.</div>}
        <div className="tm-frow">
          <label className="tm-field"><span>الاسم</span>
            <input list="tm-emps" value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الشخص المُقيَّم"/>
            <datalist id="tm-emps">{emps.map(e=><option key={e.id} value={e.full_name}/>)}</datalist>
          </label>
          <label className="tm-field"><span>الدور / الوظيفة</span>
            <input value={role} onChange={e=>setRole(e.target.value)} placeholder="بايكر · مشرف · قائد ميداني…"/>
          </label>
        </div>

        <div className="tm-prog">
          <div className="tm-prog-bar"><div style={{width:comp.pct+"%"}}/></div>
          <span>{comp.done}/{TOTAL_DRIVES} محرك مُقيَّم · {comp.pct}%</span>
        </div>

        {CATS.map(c=>{
          const on=openCat===c.k;
          const rated=c.drives.filter(k=>Number(scores[k])>0).length;
          return(<div className="tm-cat" key={c.k}>
            <div className="tm-cat-h" onClick={()=>setOpenCat(on?"":c.k)}>
              <span className="tm-cat-ic"><Icon n={c.ic} s={15}/></span>
              <b>{c.ar}</b>
              <span className="tm-cat-cnt">{rated}/{c.drives.length}</span>
              <span className={"tm-chev"+(on?" up":"")}><Icon n="fwd" s={14}/></span>
            </div>
            {on&&<div className="tm-cat-b">
              {c.drives.map(k=>{const d=DRIVE_BY_KEY[k];const s=Number(scores[k])||0;const it=interpret(s);const t=talentOf(k,s);return(
                <div className="tm-drive" key={k}>
                  <div className="tm-drive-t">
                    <b>{d.ar}</b>
                    {t?<span className={"tm-tag "+(t.side==="a"?"a":"b")}>{t.n}<i>{it.label}</i></span>:<span className="tm-tag none">غير مقيّم</span>}
                  </div>
                  <div className="tm-poles"><span>{d.b.n}</span><span>{d.a.n}</span></div>
                  <input className="tm-slider" type="range" min="0" max="9" step="1" value={s} onChange={e=>setScore(k,e.target.value)}/>
                  <div className="tm-scale">{[1,2,3,4,5,6,7,8,9].map(n=><i key={n} className={s===n?"on":""}>{n}</i>)}</div>
                </div>);})}
            </div>}
          </div>);
        })}

        <label className="tm-notes"><span>ملاحظات التقييم</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="سياق التقييم، شواهد سلوكية، توصيات…"/></label>
        {msg&&<div className={"tm-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}
        <button className="tm-save" onClick={save} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":recId?"حفظ التعديلات":"حفظ ملف المواهب"}</button>
      </div>

      {/* الملخص الحي */}
      <div className="tm-side">
        <div className="tm-panel">
          <div className="tm-panel-h"><Icon n="star" s={15}/> أبرز المواهب</div>
          {top.length===0?<p className="tm-empty2">حرّك المؤشرات لتظهر أبرز المواهب.</p>:
          <div className="tm-top">{top.map((x,i)=>(
            <div className="tm-top-i" key={i}>
              <span className={"tm-top-dot "+(x.talent.side==="a"?"a":"b")}/>
              <div style={{flex:1,minWidth:0}}><b>{x.talent.n}</b><small>{x.drive.ar}</small></div>
              <span className="tm-top-s">{x.score}</span>
            </div>))}</div>}
        </div>
        <div className="tm-panel">
          <div className="tm-panel-h"><Icon n="chart" s={15}/> ملخص الفئات</div>
          <div className="tm-catsum">{catSum.map(cs=>(
            <div className="tm-cs" key={cs.cat.k}>
              <div className="tm-cs-t"><span>{cs.cat.ar}</span><b>{cs.rated?cs.avg:"—"}</b></div>
              <div className="tm-cs-bar"><div style={{width:(cs.avg/9*100)+"%"}}/></div>
              <small>{cs.rated}/{cs.total} مُقيَّم</small>
            </div>))}</div>
          <div className="tm-legend">المقياس 1..9 · 5 متوازن · الأعلى يميل للطرف المرتفع من كل محرك.</div>
        </div>
      </div>

      {/* الملفات المحفوظة */}
      <div className="tm-saved">
        <div className="tm-saved-h"><Icon n="id" s={15}/> ملفات المواهب <span>({list.length})</span></div>
        {list.length===0?<div className="tm-empty"><div className="tm-empty-ic"><Icon n="tma" s={28}/></div><h3>لا ملفات بعد</h3><p>أنشئ أول ملف مواهب بإدخال اسم وتقييم محركاته الـ22.</p></div>:
        <div className="tm-cards">{list.map(r=>{const cp=completeness(r.scores||{});const tt=topTalents(r.scores||{},3);return(
          <div className="tm-card" key={r.id}>
            <div className="tm-card-top" onClick={()=>openRec(r)}>
              <div className="tm-card-av">{(r.subject_name||"?").trim().charAt(0)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="tm-card-name">{r.subject_name}{r.subject_role&&<small>{r.subject_role}</small>}</div>
                <div className="tm-card-track"><div style={{width:cp.pct+"%"}}/></div>
              </div>
              <span className="tm-card-pct">{cp.pct}%</span>
            </div>
            {tt.length>0&&<div className="tm-card-tags">{tt.map((x,i)=><span key={i} className={"tm-mini "+(x.talent.side==="a"?"a":"b")}>{x.talent.n}</span>)}</div>}
            <div className="tm-card-act">
              <button onClick={()=>openRec(r)}><Icon n="edit" s={13}/> فتح</button>
              <button className="del" onClick={()=>del(r)}><Icon n="trash" s={13}/></button>
            </div>
          </div>);})}</div>}
      </div>
    </div>}
  </div>);
}

function Catalog(){
  return(<div className="tm-cat-view">
    <div className="tm-hero">
      <div className="tm-hero-ic"><Icon n="tma" s={26}/></div>
      <div><h2>نموذج المواهب TMA</h2><p>{CATS.length} فئات · {TOTAL_DRIVES} محرّكاً · {TOTAL_TALENTS} موهبة — موهبتان متقابلتان لكل محرك.</p></div>
    </div>
    {CATS.map(c=>(
      <div className="tm-cv-cat" key={c.k}>
        <div className="tm-cv-h"><span className="tm-cv-ic"><Icon n={c.ic} s={16}/></span><b>{c.ar}</b><span className="tm-cv-cnt">{c.drives.length} محركات</span></div>
        <div className="tm-cv-drives">
          {c.drives.map(k=>{const d=DRIVE_BY_KEY[k];return(
            <div className="tm-cv-d" key={k}>
              <div className="tm-cv-dn">{d.ar}</div>
              <div className="tm-cv-poles">
                <div className="tm-pole a"><b>{d.a.n}</b><span>{d.a.d}</span></div>
                <div className="tm-vs">↔</div>
                <div className="tm-pole b"><b>{d.b.n}</b><span>{d.b.d}</span></div>
              </div>
            </div>);})}
        </div>
      </div>))}
  </div>);
}

const CSS=`
.tm{--b:#E8712B}
.tm-note{display:flex;align-items:center;gap:7px;background:#f6f2ff;border:1px solid #e3d9fb;color:#6d4bcb;font-size:11.5px;font-weight:700;border-radius:11px;padding:9px 12px;margin-bottom:12px}
.tm-tabs{display:flex;gap:8px;margin-bottom:16px}
.tm-tabs button{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:9px 15px;font-family:inherit;font-size:13px;font-weight:700;color:#64748b;cursor:pointer}
.tm-tabs button.on{background:linear-gradient(135deg,#E8712B,#f5a35f);border-color:transparent;color:#fff}
.tm-cnt{background:rgba(255,255,255,.25);padding:0 7px;border-radius:20px;font-size:11px}
.tm-tabs button:not(.on) .tm-cnt{background:#f4f5f7;color:#94a3b8}

/* الكتالوج */
.tm-hero{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #eceef1;border-radius:16px;padding:18px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.tm-hero-ic{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b);display:flex;align-items:center;justify-content:center;flex:none}
.tm-hero h2{font-size:17px;margin:0 0 4px}.tm-hero p{color:#64748b;font-size:12.5px;margin:0}
.tm-cv-cat{background:#fff;border:1px solid #eceef1;border-radius:16px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.tm-cv-h{display:flex;align-items:center;gap:9px;padding:13px 16px;border-bottom:1px solid #f1f3f5;background:#fafbfc}
.tm-cv-ic{width:30px;height:30px;border-radius:9px;background:#fff2e8;color:var(--b);display:flex;align-items:center;justify-content:center;flex:none}
.tm-cv-h b{font-size:14px;font-weight:800;flex:1}
.tm-cv-cnt{font-size:11px;font-weight:700;color:#94a3b8;background:#f4f5f7;padding:2px 10px;border-radius:20px}
.tm-cv-drives{padding:8px 16px 14px}
.tm-cv-d{padding:12px 0;border-bottom:1px solid #f6f7f9}.tm-cv-d:last-child{border-bottom:none}
.tm-cv-dn{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px}
.tm-cv-poles{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;gap:8px}
.tm-pole{border-radius:11px;padding:9px 11px;border:1px solid}
.tm-pole.a{background:#fef4ec;border-color:#fbdcc4}
.tm-pole.b{background:#eef4ff;border-color:#d5e3fb}
.tm-pole b{font-size:12.5px;font-weight:800;display:block;margin-bottom:3px}
.tm-pole.a b{color:#b54708}.tm-pole.b b{color:#1d5bbf}
.tm-pole span{font-size:11px;color:#64748b;line-height:1.55}
.tm-vs{display:flex;align-items:center;color:#cbd5e1;font-size:16px;font-weight:800}

/* التقييم */
.tm-assess{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;align-items:start}
.tm-form{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.tm-form-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.tm-form-h b{font-size:14.5px;font-weight:800}
.tm-new{display:inline-flex;align-items:center;gap:5px;background:#f4f5f7;border:none;border-radius:9px;padding:6px 11px;font-family:inherit;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}
.tm-link{display:flex;align-items:center;gap:7px;background:#fff2e8;border:1px solid #fbdcc4;color:#b54708;font-size:11.5px;font-weight:700;border-radius:10px;padding:8px 11px;margin-bottom:12px}
.tm-frow{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.tm-field{display:flex;flex-direction:column;gap:5px}
.tm-field span{font-size:11px;color:#64748b;font-weight:600}
.tm-field input{border:1px solid #e6e9ee;border-radius:11px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none}
.tm-field input:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.tm-prog{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.tm-prog-bar{flex:1;height:8px;background:#eef0f3;border-radius:6px;overflow:hidden}
.tm-prog-bar div{height:100%;background:linear-gradient(90deg,var(--b),#f5a35f);border-radius:6px;transition:width .3s}
.tm-prog span{font-size:11.5px;font-weight:700;color:#64748b;white-space:nowrap}
.tm-cat{border:1px solid #eceef1;border-radius:13px;margin-bottom:9px;overflow:hidden}
.tm-cat-h{display:flex;align-items:center;gap:9px;padding:11px 13px;cursor:pointer;background:#fafbfc}
.tm-cat-ic{width:26px;height:26px;border-radius:8px;background:#fff2e8;color:var(--b);display:flex;align-items:center;justify-content:center;flex:none}
.tm-cat-h b{font-size:12.5px;font-weight:800;flex:1}
.tm-cat-cnt{font-size:11px;font-weight:700;color:#94a3b8;background:#fff;border:1px solid #eceef1;padding:1px 9px;border-radius:20px}
.tm-chev{color:#94a3b8;transition:transform .2s;transform:rotate(-90deg)}
.tm-chev.up{transform:rotate(90deg)}
.tm-cat-b{padding:6px 13px 12px}
.tm-drive{padding:11px 0;border-bottom:1px solid #f6f7f9}.tm-drive:last-child{border-bottom:none}
.tm-drive-t{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.tm-drive-t b{font-size:12.5px;font-weight:800}
.tm-tag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:20px}
.tm-tag i{font-style:normal;font-weight:600;opacity:.75;font-size:10px}
.tm-tag.a{background:#fef4ec;color:#b54708}
.tm-tag.b{background:#eef4ff;color:#1d5bbf}
.tm-tag.none{background:#f4f5f7;color:#94a3b8}
.tm-poles{display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:3px}
.tm-slider{width:100%;-webkit-appearance:none;appearance:none;height:6px;border-radius:6px;background:linear-gradient(90deg,#dbe6fb,#eceef1 45%,#eceef1 55%,#fbdcc4);outline:none;cursor:pointer}
.tm-slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid var(--b);cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.tm-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid var(--b);cursor:pointer}
.tm-scale{display:flex;justify-content:space-between;margin-top:4px}
.tm-scale i{font-style:normal;font-size:9.5px;color:#cbd5e1;font-weight:700;width:16px;text-align:center}
.tm-scale i.on{color:var(--b);font-size:11px}
.tm-notes{display:flex;flex-direction:column;gap:5px;margin:12px 0}
.tm-notes span{font-size:11px;color:#64748b;font-weight:600}
.tm-notes textarea{border:1px solid #e6e9ee;border-radius:11px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none;resize:vertical}
.tm-notes textarea:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.tm-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:10px}
.tm-msg.ok{background:#e7f7ef;color:#087443}.tm-msg.err{background:#feecea;color:#b42318}
.tm-save{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px;border:none;border-radius:13px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer}
.tm-save:disabled{opacity:.6}
.tm-side{display:flex;flex-direction:column;gap:12px;position:sticky;top:80px}
.tm-panel{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.tm-panel-h{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;margin-bottom:11px}
.tm-empty2{font-size:12px;color:#94a3b8;margin:0;line-height:1.6}
.tm-top{display:flex;flex-direction:column;gap:9px}
.tm-top-i{display:flex;align-items:center;gap:9px}
.tm-top-dot{width:9px;height:9px;border-radius:50%;flex:none}
.tm-top-dot.a{background:#E8712B}.tm-top-dot.b{background:#2f6fe0}
.tm-top-i b{font-size:12.5px;font-weight:800;display:block}
.tm-top-i small{font-size:10.5px;color:#94a3b8}
.tm-top-s{font-size:13px;font-weight:800;color:#64748b;background:#f4f5f7;width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.tm-catsum{display:flex;flex-direction:column;gap:11px}
.tm-cs-t{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px}
.tm-cs-t b{color:#0f172a}
.tm-cs-bar{height:7px;background:#eef0f3;border-radius:5px;overflow:hidden}
.tm-cs-bar div{height:100%;background:linear-gradient(90deg,#7c8aa0,#0e1622);border-radius:5px}
.tm-cs small{font-size:10px;color:#b0b8c4}
.tm-legend{font-size:10.5px;color:#94a3b8;margin-top:11px;line-height:1.6;border-top:1px solid #f1f3f5;padding-top:9px}
.tm-saved{grid-column:1/-1;margin-top:4px}
.tm-saved-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:12px}
.tm-saved-h span{color:#94a3b8;font-weight:600;font-size:12px}
.tm-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.tm-card{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:13px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.tm-card-top{display:flex;align-items:center;gap:11px;cursor:pointer}
.tm-card-av{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#0e1622,#334155);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none}
.tm-card-name{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px}.tm-card-name small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:11px}
.tm-card-track{height:6px;background:#eef0f3;border-radius:5px;overflow:hidden}.tm-card-track div{height:100%;background:linear-gradient(90deg,#E8712B,#f5a35f);border-radius:5px}
.tm-card-pct{font-size:12px;font-weight:800;color:#64748b;flex:none}
.tm-card-tags{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 4px}
.tm-mini{font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:20px}
.tm-mini.a{background:#fef4ec;color:#b54708}.tm-mini.b{background:#eef4ff;color:#1d5bbf}
.tm-card-act{display:flex;gap:7px;margin-top:9px;border-top:1px solid #f6f7f9;padding-top:9px}
.tm-card-act button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:#f4f5f7;border:none;border-radius:9px;padding:7px;font-family:inherit;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer}
.tm-card-act button.del{flex:none;width:34px;color:#b42318;background:#feecea}
.tm-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:38px 24px;text-align:center}
.tm-empty-ic{width:60px;height:60px;border-radius:16px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.tm-empty h3{font-size:15px;margin:0 0 7px}.tm-empty p{color:#64748b;font-size:12px;max-width:400px;margin:0 auto;line-height:1.7}
.tm-inv-new{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.tm-inv-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:8px}
.tm-inv-desc{font-size:12px;color:#64748b;line-height:1.7;margin:0 0 14px}
.tm-inv-list{display:flex;flex-direction:column;gap:10px}
.tm-inv-card{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:13px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.tm-inv-top{display:flex;align-items:center;gap:11px;margin-bottom:8px}
.tm-inv-av{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#0e1622,#334155);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none}
.tm-inv-name{font-size:13.5px;font-weight:800;color:#0f172a}.tm-inv-name small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:11px}
.tm-inv-st{display:flex;align-items:center;gap:7px;margin-top:4px;flex-wrap:wrap}
.tm-inv-badge{font-size:10.5px;font-weight:800;color:#94a3b8;background:#f4f5f7;padding:2px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:4px}
.tm-inv-badge.done{background:#e7f7ef;color:#087443}
.tm-inv-tagx{font-size:10px;font-weight:700;color:#b54708;background:#fff2e8;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px}
.tm-inv-act{display:flex;gap:7px;border-top:1px solid #f6f7f9;padding-top:9px;flex-wrap:wrap}
.tm-inv-act button{display:inline-flex;align-items:center;justify-content:center;gap:5px;background:#f4f5f7;border:none;border-radius:9px;padding:7px 12px;font-family:inherit;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer}
.tm-inv-act button.imp{flex:1;background:linear-gradient(135deg,#12b76a,#087443);color:#fff}
.tm-inv-act button.del{margin-inline-start:auto;color:#b42318;background:#feecea;width:34px;padding:7px}
.tm-inv-imp{flex:1;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:#087443;background:#e7f7ef;border-radius:9px;padding:7px 12px}
@media(max-width:900px){
  .tm-assess{grid-template-columns:1fr}
  .tm-side{position:static}
  .tm-cards{grid-template-columns:1fr}
  .tm-cv-poles{grid-template-columns:1fr}
  .tm-vs{transform:rotate(90deg);justify-content:center}
}
`;
