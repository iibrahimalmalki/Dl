import{useState,useEffect,useRef,useCallback}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const SEV={crit:{c:"#b42318",bg:"#feecea",ic:"alert",ar:"حرِج"},warn:{c:"#b54708",bg:"#fff3e2",ic:"alert",ar:"تحذير"},info:{c:"#1d5bbf",bg:"#eef4ff",ic:"bell",ar:"معلومة"}};
const timeAgo=t=>{if(!t)return"";const s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);
  if(s<60)return"الآن";if(s<3600)return Math.floor(s/60)+" د";if(s<86400)return Math.floor(s/3600)+" س";return Math.floor(s/86400)+" ي";};

// نغمة تنبيه بسيطة عبر WebAudio (بلا ملفات) — نغمتان حسب الخطورة
function beep(sev){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    const ctx=beep._ctx||(beep._ctx=new AC());
    if(ctx.state==="suspended")ctx.resume();
    const now=ctx.currentTime;
    const seq=sev==="crit"?[[880,0],[1175,0.14],[880,0.28]]:[[660,0],[988,0.12]];
    seq.forEach(([f,dt])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine";o.frequency.value=f;
      g.gain.setValueAtTime(0,now+dt);g.gain.linearRampToValueAtTime(0.16,now+dt+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,now+dt+0.16);
      o.connect(g).connect(ctx.destination);o.start(now+dt);o.stop(now+dt+0.18);
    });
  }catch(e){}
}

export default function Notifications({me,onNav}){
  const owner=!!(me&&me.is_owner);
  const uid=me&&me.id;
  const[list,setList]=useState([]);
  const[reads,setReads]=useState(new Set());   // معرّفات المقروءة
  const[open,setOpen]=useState(false);
  const[toast,setToast]=useState(null);
  const[muted,setMuted]=useState(()=>{try{return localStorage.getItem("dw_notif_mute")==="1";}catch(e){return false;}});
  const seen=useRef(new Set());
  const toastTimer=useRef(null);

  const visibleFor=useCallback(n=>n.audience==="all"||(n.audience==="owner"&&owner)||(n.audience==="user"&&n.user_id===uid),[owner,uid]);

  const load=useCallback(async()=>{
    const{data}=await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(50);
    const rows=(data||[]).filter(visibleFor);
    setList(rows);rows.forEach(r=>seen.current.add(r.id));
    if(uid){const{data:rd}=await supabase.from("notification_reads").select("notification_id").eq("user_id",uid);
      setReads(new Set((rd||[]).map(x=>x.notification_id)));}
  },[visibleFor,uid]);

  useEffect(()=>{load();},[load]);

  // بثّ حيّ — عند وصول إشعار جديد: نغمة + toast + إدراج
  useEffect(()=>{
    const ch=supabase.channel("notif-live").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},payload=>{
      const n=payload.new;if(!n||!visibleFor(n)||seen.current.has(n.id))return;
      seen.current.add(n.id);
      setList(p=>[n,...p].slice(0,50));
      if(!muted)beep(n.severity);
      setToast(n);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000);
    }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[visibleFor,muted]);

  const unread=list.filter(n=>!reads.has(n.id)).length;

  const markRead=async(n)=>{
    if(reads.has(n.id)||!uid)return;
    setReads(p=>new Set(p).add(n.id));
    await supabase.from("notification_reads").upsert({notification_id:n.id,user_id:uid},{onConflict:"notification_id,user_id"});
  };
  const markAll=async()=>{
    if(!uid)return;const un=list.filter(n=>!reads.has(n.id));
    setReads(new Set(list.map(n=>n.id)));
    if(un.length)await supabase.from("notification_reads").upsert(un.map(n=>({notification_id:n.id,user_id:uid})),{onConflict:"notification_id,user_id"});
  };
  const go=(n)=>{markRead(n);setOpen(false);setToast(null);if(n.module&&onNav)onNav(n.module);};
  const toggleMute=()=>{setMuted(m=>{const v=!m;try{localStorage.setItem("dw_notif_mute",v?"1":"0");}catch(e){}if(!v)beep("info");return v;});};

  return(<>
    <style>{CSS}</style>
    <div className="nt-wrap">
      <button className="nt-bell" onClick={()=>setOpen(o=>!o)} title="الإشعارات">
        <Icon n="bell" s={18}/>
        {unread>0&&<span className="nt-badge">{unread>9?"9+":unread}</span>}
      </button>
      {open&&<>
        <div className="nt-scrim" onClick={()=>setOpen(false)}/>
        <div className="nt-panel">
          <div className="nt-head">
            <b>الإشعارات {unread>0&&<span className="nt-cnt">{unread}</span>}</b>
            <div className="nt-actions">
              <button onClick={toggleMute} title={muted?"تشغيل الصوت":"كتم الصوت"} className={muted?"muted":""}><Icon n={muted?"x":"bell"} s={14}/></button>
              {unread>0&&<button onClick={markAll} title="تعليم الكل مقروء"><Icon n="check" s={14}/></button>}
            </div>
          </div>
          <div className="nt-list">
            {list.length===0&&<div className="nt-empty"><Icon n="inbox" s={26}/><p>لا إشعارات بعد</p></div>}
            {list.map(n=>{const s=SEV[n.severity]||SEV.info;const isr=reads.has(n.id);return(
              <div key={n.id} className={"nt-item"+(isr?"":" un")} onClick={()=>go(n)}>
                <span className="nt-ic" style={{background:s.bg,color:s.c}}><Icon n={s.ic} s={15}/></span>
                <div className="nt-txt"><b>{n.title}</b>{n.body&&<span>{n.body}</span>}<small>{timeAgo(n.created_at)}</small></div>
                {!isr&&<span className="nt-dot" style={{background:s.c}}/>}
              </div>);})}
          </div>
        </div>
      </>}
    </div>

    {toast&&(()=>{const s=SEV[toast.severity]||SEV.info;return(
      <div className="nt-toast" style={{borderInlineStartColor:s.c}} onClick={()=>go(toast)}>
        <span className="nt-ic" style={{background:s.bg,color:s.c}}><Icon n={s.ic} s={16}/></span>
        <div className="nt-txt"><b>{toast.title}</b>{toast.body&&<span>{toast.body}</span>}</div>
        <button className="nt-x" onClick={e=>{e.stopPropagation();setToast(null);}}><Icon n="x" s={14}/></button>
      </div>);})()}
  </>);
}

const CSS=`
.nt-wrap{position:relative}
.nt-bell{position:relative;width:40px;height:40px;border-radius:11px;border:1px solid #e6e9ee;background:#fff;color:#334155;display:flex;align-items:center;justify-content:center;cursor:pointer}
.nt-bell:hover{background:#f8fafc}
.nt-badge{position:absolute;top:-4px;inset-inline-end:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#f04438;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #fff}
.nt-scrim{position:fixed;inset:0;z-index:80}
.nt-panel{position:absolute;inset-inline-end:0;top:48px;width:340px;max-width:88vw;max-height:70vh;background:#fff;border:1px solid #e6e9ee;border-radius:16px;box-shadow:0 16px 48px rgba(16,24,40,.22);z-index:81;display:flex;flex-direction:column;overflow:hidden}
.nt-head{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid #eceef1}
.nt-head b{font-size:14px;font-weight:800;display:flex;align-items:center;gap:7px}
.nt-cnt{background:#f04438;color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px}
.nt-actions{display:flex;gap:6px}
.nt-actions button{width:30px;height:30px;border-radius:8px;border:1px solid #e6e9ee;background:#fff;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center}
.nt-actions button.muted{background:#feecea;color:#b42318;border-color:#f7bfba}
.nt-list{overflow-y:auto}
.nt-item{display:flex;gap:11px;align-items:flex-start;padding:12px 14px;border-bottom:1px solid #f4f5f7;cursor:pointer;position:relative}
.nt-item:hover{background:#fafbfc}
.nt-item.un{background:#fbfdff}
.nt-ic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.nt-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.nt-txt b{font-size:12.5px;font-weight:800;color:#0f172a;line-height:1.4}
.nt-txt span{font-size:11.5px;color:#475569;line-height:1.5}
.nt-txt small{font-size:10px;color:#94a3b8;margin-top:2px}
.nt-dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:5px}
.nt-empty{text-align:center;color:#cbd5e1;padding:34px 0}.nt-empty p{color:#94a3b8;font-size:12.5px;margin-top:8px}
.nt-toast{position:fixed;inset-block-start:16px;inset-inline-start:16px;z-index:200;width:330px;max-width:90vw;background:#fff;border:1px solid #e6e9ee;border-inline-start-width:4px;border-radius:13px;box-shadow:0 12px 40px rgba(16,24,40,.25);padding:12px 13px;display:flex;gap:11px;align-items:flex-start;cursor:pointer;animation:ntin .25s ease}
@keyframes ntin{from{transform:translateY(-12px);opacity:0}to{transform:translateY(0);opacity:1}}
.nt-toast .nt-txt b{font-size:13px}.nt-toast .nt-txt span{font-size:11.5px}
.nt-x{border:none;background:transparent;color:#94a3b8;cursor:pointer;flex:none;padding:2px}
@media(max-width:520px){.nt-toast{inset-inline:10px;width:auto}}
@media print{.nt-wrap,.nt-toast{display:none}}
`;
