import{useState,useEffect}from"react";
import{supabase}from"./supabase";
import{ITEMS,SCALE,TOTAL_ITEMS,scoreFromAnswers,answeredCount}from"./tmaQuestionnaire";

export default function TMAQuestionnaire({token}){
  const[inv,setInv]=useState(null);
  const[loading,setLoading]=useState(true);
  const[i,setI]=useState(0);
  const[ans,setAns]=useState({});
  const[submitting,setSubmitting]=useState(false);
  const[done,setDone]=useState(false);

  useEffect(()=>{(async()=>{
    const{data}=await supabase.from("tma_invites").select("*").eq("id",token).maybeSingle();
    setInv(data||null);
    if(data){setAns(data.answers||{});if(data.status==="completed")setDone(true);}
    setLoading(false);
  })();},[token]);

  const pick=(v)=>{
    const na={...ans,[i]:v};setAns(na);
    setTimeout(()=>{ if(i<TOTAL_ITEMS-1)setI(i+1); },180);
  };
  const submit=async()=>{
    setSubmitting(true);
    try{
      const scores=scoreFromAnswers(ans);
      await supabase.from("tma_invites").update({answers:ans,scores,status:"completed",completed_at:new Date().toISOString()}).eq("id",token);
      setDone(true);
    }catch(e){alert("ত্রুটি / خطأ: "+(e.message||e));}
    setSubmitting(false);
  };

  const wrap={minHeight:"100dvh",background:"linear-gradient(170deg,#FFF9F0,#FFF3DC)",fontFamily:"'Segoe UI',Tahoma,sans-serif"};
  if(loading)return <div style={{...wrap,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:40,height:40,border:"3px solid #fde4c4",borderTopColor:"#E8712B",borderRadius:"50%",animation:"spin .8s linear infinite"}}/></div>;
  if(!inv)return <div style={{...wrap,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center"}}><div><div style={{fontSize:48}}>⚠️</div><p style={{color:"#dc2626",fontWeight:700}}>লিংকটি সঠিক নয় · الرابط غير صحيح</p></div></div>;

  if(done)return(<div style={{...wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center"}}>
    <div style={{width:76,height:76,background:"linear-gradient(135deg,#2E7D32,#1b5e20)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:34,fontWeight:900,margin:"0 auto 18px"}}>✓</div>
    <h2 style={{color:"#1e293b",margin:"0 0 6px"}}>ধন্যবাদ! · شكراً لك</h2>
    <p style={{color:"#475569",fontSize:13,lineHeight:1.7,maxWidth:320}}>আপনার উত্তরগুলো সংরক্ষিত হয়েছে।<br/>تم استلام إجاباتك بنجاح.</p>
  </div>);

  const answered=answeredCount(ans);
  const pct=Math.round(answered/TOTAL_ITEMS*100);
  const it=ITEMS[i];const cur=ans[i];
  const allDone=answered>=TOTAL_ITEMS;

  return(<div style={wrap}>
    {/* رأس */}
    <div style={{background:"linear-gradient(135deg,#E8712B,#f5a35f)",padding:"18px 18px 14px",position:"sticky",top:0,zIndex:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",color:"#fff"}}>
        <div>
          <div style={{fontSize:16,fontWeight:900}}>{inv.subject_name}</div>
          <div style={{fontSize:11,opacity:.9}}>ব্যক্তিত্ব প্রশ্নাবলী · استبيان المواهب</div>
        </div>
        <div style={{fontSize:13,fontWeight:800,background:"rgba(255,255,255,.2)",padding:"4px 11px",borderRadius:20}}>{answered}/{TOTAL_ITEMS}</div>
      </div>
      <div style={{height:7,background:"rgba(255,255,255,.28)",borderRadius:6,marginTop:12,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:"#fff",borderRadius:6,transition:"width .3s"}}/>
      </div>
    </div>

    <div style={{padding:"18px 16px",maxWidth:560,margin:"0 auto"}}>
      <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:12,padding:"10px 14px",color:"#92400e",fontSize:12,fontWeight:700,marginBottom:16,textAlign:"center",lineHeight:1.6}}>
        সঠিক বা ভুল উত্তর নেই — সততার সাথে বেছে নিন<br/><span style={{fontSize:11,opacity:.85,fontWeight:500}}>لا توجد إجابة صحيحة أو خاطئة — اختر بصدق</span>
      </div>

      {/* بطاقة السؤال */}
      <div style={{background:"#fff",borderRadius:20,padding:"22px 18px",boxShadow:"0 4px 20px rgba(232,113,43,.1)",border:"1px solid #f4e6d6"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
          <span style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#E8712B,#f5a35f)",color:"#fff",fontWeight:900,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</span>
        </div>
        <div style={{fontSize:16,fontWeight:800,color:"#1e293b",textAlign:"center",lineHeight:1.6,marginBottom:8}}>{it.bn}</div>
        <div style={{fontSize:14,fontWeight:700,color:"#a8834f",textAlign:"center",lineHeight:1.6,direction:"rtl",marginBottom:20}}>{it.ar}</div>

        {/* سلّم الوجوه */}
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {SCALE.map(s=>{const on=cur===s.v;return(
            <button key={s.v} onClick={()=>pick(s.v)} style={{
              display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,cursor:"pointer",
              border:on?"2px solid #E8712B":"1.5px solid #eee2d3",
              background:on?"linear-gradient(135deg,#fff2e8,#ffe6d2)":"#fff",
              fontFamily:"inherit",transition:"all .12s",textAlign:"start"}}>
              <span style={{fontSize:24,lineHeight:1}}>{s.face}</span>
              <span style={{flex:1}}>
                <span style={{display:"block",fontSize:13.5,fontWeight:800,color:on?"#b54708":"#334155"}}>{s.bn}</span>
                <span style={{display:"block",fontSize:11.5,color:"#94a3b8",direction:"rtl"}}>{s.ar}</span>
              </span>
              {on&&<span style={{color:"#E8712B",fontWeight:900,fontSize:16}}>✓</span>}
            </button>);})}
        </div>
      </div>

      {/* تنقّل */}
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button onClick={()=>setI(Math.max(0,i-1))} disabled={i===0} style={{flex:"0 0 auto",padding:"12px 18px",borderRadius:13,border:"1.5px solid #eee2d3",background:"#fff",color:"#64748b",fontFamily:"inherit",fontSize:13,fontWeight:800,cursor:i===0?"default":"pointer",opacity:i===0?.4:1}}>← পূর্ববর্তী</button>
        {i<TOTAL_ITEMS-1
          ? <button onClick={()=>setI(i+1)} style={{flex:1,padding:"12px",borderRadius:13,border:"none",background:cur?"linear-gradient(135deg,#E8712B,#CC5200)":"#e2d3c2",color:"#fff",fontFamily:"inherit",fontSize:13.5,fontWeight:800,cursor:"pointer"}}>পরবর্তী →</button>
          : <button onClick={submit} disabled={!allDone||submitting} style={{flex:1,padding:"12px",borderRadius:13,border:"none",background:allDone?"linear-gradient(135deg,#2E7D32,#1b5e20)":"#cbd5c0",color:"#fff",fontFamily:"inherit",fontSize:13.5,fontWeight:800,cursor:allDone?"pointer":"default"}}>{submitting?"পাঠানো হচ্ছে…":"জমা দিন · إرسال ✓"}</button>}
      </div>
      {i===TOTAL_ITEMS-1&&!allDone&&<div style={{textAlign:"center",fontSize:11.5,color:"#b54708",marginTop:10,fontWeight:700}}>আরও {TOTAL_ITEMS-answered}টি বাকি · بقي {TOTAL_ITEMS-answered} سؤال</div>}
    </div>
  </div>);
}
