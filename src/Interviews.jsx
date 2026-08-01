import{useState,useEffect,useMemo}from"react";
import{supabase,SITE_URL}from"./supabase";
import Icon from"./Icon";
import{completeness,topTalents}from"./tma";
const tmaQLink=id=>`${SITE_URL}?tma=${id}`;

const waNum=raw=>{let d=String(raw||"").replace(/[^0-9]/g,"");if(!d)return"";if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("966")||d.startsWith("880"))return d;if(d.startsWith("0"))return(d.length===11?"880":"966")+d.replace(/^0+/,"");if(d.startsWith("5")&&d.length===9)return"966"+d;if(d.startsWith("1")&&d.length===10)return"880"+d;return d;};
const STATUS={pending:{ar:"بانتظار الإجابة",color:"#b54708",bg:"#fef3e2"},completed:{ar:"مكتملة",color:"#087443",bg:"#e7f7ef"}};
const DEC={pass:{ar:"مناسب",color:"#087443",bg:"#e7f7ef",ic:"check"},hold:{ar:"قيد الدراسة",color:"#b54708",bg:"#fef3e2",ic:"clock"},reject:{ar:"غير مناسب",color:"#b42318",bg:"#feecea",ic:"x"}};
const fmtD=d=>d?new Date(d).toLocaleDateString("en-GB"):"—";

export default function Interviews({owner,onOpenTMA}){
  const[loading,setLoading]=useState(true);
  const[rows,setRows]=useState([]);
  const[sel,setSel]=useState(null);
  const[ev,setEv]=useState({rating:"",decision:"",note:""});
  const[msg,setMsg]=useState(null);const[saving,setSaving]=useState(false);
  const[tmaMap,setTmaMap]=useState({}); // interview_id -> tma profile (owner only)
  const[qMap,setQMap]=useState({});     // interview_id -> tma questionnaire invite (owner only)

  const load=async()=>{
    setLoading(true);
    const{data}=await supabase.from("interview_sessions").select("*,applicants(id,full_name,application_number,whatsapp,ai_score_total,status)").order("created_at",{ascending:false});
    setRows(data||[]);
    if(owner){
      const{data:tm}=await supabase.from("tma_assessments").select("id,interview_id,applicant_id,subject_name,scores").not("interview_id","is",null);
      const m={};(tm||[]).forEach(t=>{if(t.interview_id)m[t.interview_id]=t;});setTmaMap(m);
      const{data:iv}=await supabase.from("tma_invites").select("id,interview_id,status,answers").not("interview_id","is",null);
      const qm={};(iv||[]).forEach(t=>{if(t.interview_id)qm[t.interview_id]=t;});setQMap(qm);
    }
    setLoading(false);
  };
  useEffect(()=>{load();},[owner]);

  const openTMA=(r)=>{onOpenTMA&&onOpenTMA({name:r.applicants?.full_name||"",role:"مرشّح للتوظيف",interview_id:r.id,applicant_id:r.applicants?.id||null,source:"interview"});};
  const sendQ=async(r)=>{
    setMsg(null);
    try{
      let inv=qMap[r.id];
      if(!inv){
        const{data,error}=await supabase.from("tma_invites").insert({subject_name:r.applicants?.full_name||"",subject_role:"مرشّح للتوظيف",interview_id:r.id,applicant_id:r.applicants?.id||null}).select().single();
        if(error)throw error;inv=data;setQMap(p=>({...p,[r.id]:data}));
      }
      const t=`السلام عليكم ${r.applicants?.full_name||""}،\nنرجو تعبئة استبيان المواهب عبر الرابط:\n${tmaQLink(inv.id)}\n\nদয়া করে এই লিংকে ব্যক্তিত্ব প্রশ্নাবলী পূরণ করুন।`;
      window.open(`https://wa.me/${waNum(r.applicants?.whatsapp)}?text=${encodeURIComponent(t)}`);
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
  };

  const open=(r)=>{setSel(r);setEv({rating:r.rating??"",decision:r.decision||"",note:r.note||""});setMsg(null);};
  const saveEv=async()=>{
    setSaving(true);setMsg(null);
    try{
      const patch={rating:ev.rating!==""?Number(ev.rating):null,decision:ev.decision||null,note:ev.note||null,reviewed_at:new Date().toISOString()};
      const{error}=await supabase.from("interview_sessions").update(patch).eq("id",sel.id);if(error)throw error;
      setRows(p=>p.map(x=>x.id===sel.id?{...x,...patch}:x));setSel(s=>({...s,...patch}));
      setMsg({ok:true,t:"تم حفظ التقييم"});
    }catch(e){setMsg({ok:false,t:"خطأ: "+(e.message||e)});}
    setSaving(false);
  };
  const link=r=>`${SITE_URL}?interview=${r.id}`;
  const copyLink=async r=>{try{await navigator.clipboard.writeText(link(r));setMsg({ok:true,t:"تم نسخ الرابط"});}catch{setMsg({ok:true,t:link(r)});}};
  const waSend=r=>{const msgT=`السلام عليكم ${r.applicants?.full_name||""}،\nيرجى الإجابة على أسئلة المقابلة عبر الرابط:\n${link(r)}\n\nদয়া করে এই লিংকে প্রশ্নগুলোর উত্তর দিন।`;window.open(`https://wa.me/${waNum(r.applicants?.whatsapp)}?text=${encodeURIComponent(msgT)}`);};

  const kpis=useMemo(()=>{
    const total=rows.length;const done=rows.filter(r=>r.status==="completed").length;
    const rated=rows.filter(r=>r.rating!=null);const avg=rated.length?Math.round(rated.reduce((a,r)=>a+Number(r.rating),0)/rated.length*10)/10:null;
    return{total,pending:total-done,done,avg};
  },[rows]);

  if(loading)return <div className="dw-skel" style={{height:280}}/>;

  // شاشة التفاصيل
  if(sel){const st=STATUS[sel.status]||STATUS.pending;const qs=sel.questions||[];const ans=sel.answers||{};return(
    <div className="iv">
      <style>{CSS}</style>
      <div className="iv-head">
        <button className="iv-back" onClick={()=>setSel(null)}><Icon n="back" s={15}/> رجوع</button>
        <div style={{flex:1,minWidth:0}}><div className="iv-h-t">{sel.applicants?.full_name||"—"}</div><div className="iv-h-s">طلب #{sel.applicants?.application_number||"—"} · {st.ar}</div></div>
        <span className="iv-badge" style={{background:st.bg,color:st.color}}>{st.ar}</span>
      </div>
      {msg&&<div className={"iv-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}

      <div className="iv-actions">
        <button className="iv-btn ghost" onClick={()=>copyLink(sel)}><Icon n="link" s={15}/> نسخ الرابط</button>
        {sel.applicants?.whatsapp&&<button className="iv-btn ok" onClick={()=>waSend(sel)}><Icon n="phone" s={15}/> إرسال واتساب</button>}
      </div>

      {/* الأسئلة والأجوبة */}
      <div className="iv-sec-h"><Icon n="interview" s={16}/> الأسئلة والأجوبة <span>({qs.length})</span></div>
      {qs.length===0?<div className="iv-empty2">لا أسئلة في هذه الجلسة</div>:
      qs.map((q,i)=>{const a=ans[i]||ans[String(i)];return(
        <div className="iv-qa" key={i}>
          <div className="iv-q"><span className="iv-qn">{i+1}</span><div>{q.ar&&<div className="iv-q-ar">{q.ar}</div>}{q.bn&&<div className="iv-q-bn">{q.bn}</div>}</div></div>
          <div className={"iv-a"+(a?"":" empty")}>{a||"— لم يُجب بعد —"}</div>
        </div>);})}

      {/* التقييم */}
      <div className="iv-sec-h"><Icon n="star" s={16}/> تقييم المقابلة</div>
      <div className="iv-eval">
        <div className="iv-ev-row">
          <label className="iv-fld"><span>التقييم (من 5)</span><input type="number" step="0.5" min="0" max="5" value={ev.rating} onChange={e=>setEv({...ev,rating:e.target.value})} placeholder="4.5"/></label>
          <div className="iv-fld" style={{flex:2}}><span>القرار</span>
            <div className="iv-decs">{Object.entries(DEC).map(([k,d])=><button key={k} className={"iv-dec"+(ev.decision===k?" on":"")} style={ev.decision===k?{background:d.bg,color:d.color,borderColor:d.color}:{}} onClick={()=>setEv({...ev,decision:ev.decision===k?"":k})}><Icon n={d.ic} s={13}/> {d.ar}</button>)}</div>
          </div>
        </div>
        <label className="iv-fld"><span>ملاحظات المقيّم</span><textarea rows={2} value={ev.note} onChange={e=>setEv({...ev,note:e.target.value})} placeholder="انطباع، نقاط قوة/ضعف، توصية…"/></label>
        <button className="iv-save" onClick={saveEv} disabled={saving}><Icon n="save" s={15}/> {saving?"جارٍ الحفظ…":"حفظ التقييم"}</button>
      </div>

      {/* التقييم النفسي — المواهب TMA (المالك فقط) */}
      {owner&&<>
        <div className="iv-sec-h"><Icon n="tma" s={16}/> التقييم النفسي — المواهب TMA</div>
        {(()=>{const t=tmaMap[sel.id];const cp=t?completeness(t.scores||{}):null;const tt=t?topTalents(t.scores||{},4):[];return(
          <div className="iv-tma">
            {t?<>
              <div className="iv-tma-top"><div><b>ملف مواهب موجود</b><small>{cp.done}/22 محرك · {cp.pct}%</small></div><span className="iv-tma-pct">{cp.pct}%</span></div>
              {tt.length>0&&<div className="iv-tma-tags">{tt.map((x,i)=><span key={i} className={"iv-tma-tag "+(x.talent.side==="a"?"a":"b")}>{x.talent.n}</span>)}</div>}
              <button className="iv-btn tma" onClick={()=>openTMA(sel)}><Icon n="edit" s={14}/> فتح ملف المواهب</button>
            </>:<>
              <p className="iv-tma-hint">إمّا أن يعبّئ المرشّح استبيان المواهب بنفسه (تقييم ذاتي، عربي + بنغالي)، أو تقيّمه أنت يدوياً على المحاور الـ22. الملف يُربط بهذه المقابلة تلقائياً.</p>
              {(()=>{const q=qMap[sel.id];return q?<div className="iv-tma-qst">{q.status==="completed"?<span className="iv-tma-qdone"><Icon n="check" s={12}/> عبّأ المرشّح الاستبيان — استورد النتائج من وحدة المواهب</span>:<span className="iv-tma-qwait"><Icon n="clock" s={12}/> أُرسل الاستبيان — بانتظار إجابة المرشّح</span>}</div>:null;})()}
              {sel.applicants?.whatsapp&&<button className="iv-btn qsend" onClick={()=>sendQ(sel)}><Icon n="phone" s={14}/> {qMap[sel.id]?"إعادة إرسال الاستبيان":"إرسال استبيان المواهب (واتساب)"}</button>}
              <button className="iv-btn tma" onClick={()=>openTMA(sel)}><Icon n="tma" s={14}/> تقييم يدوي للمرشّح</button>
            </>}
          </div>);})()}
      </>}
    </div>);}

  // القائمة
  return(<div className="iv">
    <style>{CSS}</style>
    <div className="iv-kpis">
      <K ic="interview" c="#E8712B" bg="#fff2e8" t="إجمالي المقابلات" v={kpis.total}/>
      <K ic="clock" c="#b54708" bg="#fef3e2" t="بانتظار الإجابة" v={kpis.pending}/>
      <K ic="check" c="#087443" bg="#e7f7ef" t="مكتملة" v={kpis.done}/>
      <K ic="star" c="#175cd3" bg="#eff6ff" t="متوسط التقييم" v={kpis.avg!=null?kpis.avg:"—"}/>
    </div>
    <div className="iv-hint"><Icon n="alert" s={13}/> تُنشأ جلسات المقابلة من ملف المتقدّم (زر «أسئلة المقابلة»). هنا تتابعها وتقيّمها وترسل الروابط.</div>

    {rows.length===0?<div className="iv-empty"><div className="iv-empty-ic"><Icon n="interview" s={30}/></div><h3>لا مقابلات بعد</h3><p>افتح ملف متقدّم من شاشة المتقدّمين وأنشئ أسئلة مقابلة — ستظهر الجلسة هنا لمتابعتها وتقييمها.</p></div>:
    <div className="iv-list">{rows.map(r=>{const st=STATUS[r.status]||STATUS.pending;const qn=(r.questions||[]).length;const an=Object.values(r.answers||{}).filter(x=>x&&String(x).trim()).length;const dec=r.decision?DEC[r.decision]:null;return(
      <div className="iv-card" key={r.id} onClick={()=>open(r)}>
        <div className="iv-c-av">{(r.applicants?.full_name||"?").trim().charAt(0)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="iv-c-name">{r.applicants?.full_name||"—"}<small>#{r.applicants?.application_number||"—"}</small></div>
          <div className="iv-c-sub">{qn} سؤال · {an}/{qn} إجابة · {fmtD(r.created_at)}</div>
        </div>
        <div className="iv-c-right">
          {r.rating!=null&&<span className="iv-rate">{Number(r.rating).toFixed(1)}</span>}
          {dec?<span className="iv-badge sm" style={{background:dec.bg,color:dec.color}}>{dec.ar}</span>:<span className="iv-badge sm" style={{background:st.bg,color:st.color}}>{st.ar}</span>}
        </div>
      </div>);})}</div>}
  </div>);
}
function K({ic,c,bg,t,v}){return(<div className="iv-kpi"><span className="iv-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div><div className="iv-kv">{v}</div><div className="iv-kl">{t}</div></div></div>);}

const CSS=`
.iv{--b:#E8712B}
.iv-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.iv-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.iv-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.iv-kv{font-size:20px;font-weight:800;letter-spacing:-.5px}.iv-kl{font-size:11px;color:#64748b;font-weight:600}
.iv-hint{display:flex;align-items:flex-start;gap:7px;background:#fffbeb;border:1px solid #fde9c8;color:#92600e;font-size:11.5px;font-weight:600;border-radius:11px;padding:10px 12px;margin-bottom:14px;line-height:1.6}
.iv-list{display:flex;flex-direction:column;gap:10px}
.iv-card{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eceef1;border-radius:14px;padding:12px 14px;box-shadow:0 1px 2px rgba(16,24,40,.05);cursor:pointer}
.iv-card:hover{border-color:#f5c9a8}
.iv-c-av{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none}
.iv-c-name{font-size:14px;font-weight:800;color:#0f172a}.iv-c-name small{color:#94a3b8;font-weight:600;margin-inline-start:6px;font-size:11.5px}
.iv-c-sub{font-size:11.5px;color:#64748b;margin-top:2px}
.iv-c-right{display:flex;align-items:center;gap:8px;flex:none}
.iv-rate{background:#eff6ff;color:#175cd3;font-weight:800;font-size:12.5px;padding:3px 9px;border-radius:8px}
.iv-badge{display:inline-flex;align-items:center;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:800}
.iv-badge.sm{font-size:10.5px;padding:3px 10px}
.iv-head{display:flex;align-items:center;gap:12px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid #eceef1}
.iv-back{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e6e9ee;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:12.5px;font-weight:700;color:#334155;cursor:pointer;flex:none}
.iv-h-t{font-size:16px;font-weight:800;color:#0f172a}.iv-h-s{font-size:12px;color:#64748b}
.iv-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.iv-msg.ok{background:#e7f7ef;color:#087443}.iv-msg.err{background:#feecea;color:#b42318}
.iv-actions{display:flex;gap:8px;margin-bottom:14px}
.iv-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.iv-btn.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.iv-btn.ok{background:linear-gradient(135deg,#12b76a,#087443);color:#fff}
.iv-btn.tma{width:100%;justify-content:center;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;margin-top:4px}
.iv-tma{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:15px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:14px}
.iv-tma-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.iv-tma-top b{font-size:13px;font-weight:800;display:block}.iv-tma-top small{font-size:11px;color:#94a3b8}
.iv-tma-pct{font-size:18px;font-weight:800;color:#E8712B}
.iv-tma-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.iv-tma-tag{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px}
.iv-tma-tag.a{background:#fef4ec;color:#b54708}.iv-tma-tag.b{background:#eef4ff;color:#1d5bbf}
.iv-tma-hint{font-size:12px;color:#64748b;line-height:1.6;margin:0 0 12px}
.iv-btn.qsend{width:100%;justify-content:center;background:linear-gradient(135deg,#12b76a,#087443);color:#fff;margin-bottom:8px}
.iv-tma-qst{margin-bottom:10px}
.iv-tma-qdone{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:#087443;background:#e7f7ef;border-radius:9px;padding:7px 11px}
.iv-tma-qwait{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:#b54708;background:#fef3e2;border-radius:9px;padding:7px 11px}
.iv-sec-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin:6px 0 10px}
.iv-sec-h span{color:#94a3b8;font-weight:600;font-size:12px}
.iv-empty2{color:#94a3b8;font-size:12.5px;text-align:center;padding:20px;background:#fff;border:1px solid #eceef1;border-radius:12px}
.iv-qa{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.iv-q{display:flex;gap:10px;margin-bottom:9px}
.iv-qn{width:24px;height:24px;border-radius:8px;background:#fff2e8;color:#E8712B;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}
.iv-q-ar{font-size:13px;font-weight:700;color:#0f172a;line-height:1.5}
.iv-q-bn{font-size:11.5px;color:#94a3b8;margin-top:2px}
.iv-a{background:#fafbfc;border:1px solid #f1f3f5;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#334155;line-height:1.6;white-space:pre-wrap}
.iv-a.empty{color:#cbd5e1;font-style:italic}
.iv-eval{background:#fff;border:1px solid #eceef1;border-radius:16px;padding:15px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.iv-ev-row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.iv-fld{display:flex;flex-direction:column;gap:5px;flex:1;min-width:120px}
.iv-fld span{font-size:11px;color:#64748b;font-weight:600}
.iv-fld input,.iv-fld textarea{border:1px solid #e6e9ee;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;font-weight:600;color:#0f172a;outline:none;resize:vertical}
.iv-fld input:focus,.iv-fld textarea:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.iv-decs{display:flex;gap:6px;flex-wrap:wrap}
.iv-dec{display:inline-flex;align-items:center;gap:5px;padding:8px 12px;border-radius:10px;border:1px solid #e6e9ee;background:#fff;font-family:inherit;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}
.iv-save{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:12px;margin-top:12px;border:none;border-radius:12px;background:linear-gradient(135deg,#E8712B,#CC5200);color:#fff;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}
.iv-save:disabled{opacity:.6}
.iv-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.iv-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.iv-empty h3{font-size:16px;margin:0 0 8px}.iv-empty p{color:#64748b;font-size:12.5px;max-width:440px;margin:0 auto;line-height:1.7}
@media(max-width:720px){.iv-kpis{grid-template-columns:1fr 1fr}}
`;
