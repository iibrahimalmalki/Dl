import{useState,useEffect,useRef,useCallback}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const OWNER_WA="966566884419"; // رقم المالك لخطّ واتساب الأخير
const SEV={crit:{c:"#b42318",bg:"#feecea",ic:"alert"},warn:{c:"#b54708",bg:"#fff3e2",ic:"alert"},info:{c:"#1d5bbf",bg:"#eef4ff",ic:"bell"}};
const CATS=[["incidents","الحوادث"],["renewals","الوثائق والإقامات"],["housing","السكن"],["supply","الإمداد"],["settlement","التسوية"],["field_rounds","الجولات"],["escalation","التصعيد"],["digest","الملخّص اليومي"],["system","النظام"]];
const CAT_AR=Object.fromEntries(CATS);
const timeAgo=t=>{if(!t)return"";const s=Math.max(0,(Date.now()-new Date(t).getTime())/1000);
  if(s<60)return"الآن";if(s<3600)return Math.floor(s/60)+" د";if(s<86400)return Math.floor(s/3600)+" س";return Math.floor(s/86400)+" ي";};

// نغمات حسب الخطورة عبر WebAudio (بلا ملفات)
function beep(sev){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    const ctx=beep._ctx||(beep._ctx=new AC());if(ctx.state==="suspended")ctx.resume();
    const now=ctx.currentTime;
    const seq=sev==="crit"?[[880,0],[1175,0.14],[880,0.28],[1319,0.42]]
            :sev==="warn"?[[740,0],[988,0.15]]:[[620,0],[820,0.12]];
    seq.forEach(([f,dt])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=f;
      g.gain.setValueAtTime(0,now+dt);g.gain.linearRampToValueAtTime(0.16,now+dt+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,now+dt+0.17);
      o.connect(g).connect(ctx.destination);o.start(now+dt);o.stop(now+dt+0.19);});
  }catch(e){}
}
const setBadge=n=>{try{if(n>0)navigator.setAppBadge&&navigator.setAppBadge(n);else navigator.clearAppBadge&&navigator.clearAppBadge();}catch(e){}};

export default function Notifications({me,onNav}){
  const owner=!!(me&&me.is_owner),uid=me&&me.id;
  const[list,setList]=useState([]);
  const[st,setSt]=useState({});           // id → {read_at,ack_at,snooze_until}
  const[prefs,setPrefs]=useState({muted_categories:[],quiet_start:null,quiet_end:null,sound_enabled:true});
  const[open,setOpen]=useState(false);const[cfg,setCfg]=useState(false);
  const[toast,setToast]=useState(null);
  const seen=useRef(new Set());const tt=useRef(null);

  const visibleFor=useCallback(n=>n.audience==="all"||(n.audience==="owner"&&owner)||(n.audience==="user"&&n.user_id===uid)||(n.audience||"").startsWith("perm:"),[owner,uid]);
  const inQuiet=useCallback(()=>{const{quiet_start:a,quiet_end:b}=prefs;if(a==null||b==null)return false;const h=new Date().getHours();return a<=b?(h>=a&&h<b):(h>=a||h<b);},[prefs]);
  const shouldSound=useCallback(n=>prefs.sound_enabled&&!(prefs.muted_categories||[]).includes(n.category)&&!inQuiet(),[prefs,inQuiet]);

  const load=useCallback(async()=>{
    const{data}=await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(60);
    const rows=(data||[]).filter(visibleFor);setList(rows);rows.forEach(r=>seen.current.add(r.id));
    if(uid){
      const{data:rd}=await supabase.from("notification_reads").select("notification_id,read_at,ack_at,snooze_until").eq("user_id",uid);
      const m={};(rd||[]).forEach(x=>m[x.notification_id]={read_at:x.read_at,ack_at:x.ack_at,snooze_until:x.snooze_until});setSt(m);
      const{data:p}=await supabase.from("notification_prefs").select("*").eq("user_id",uid).maybeSingle();
      if(p)setPrefs({muted_categories:p.muted_categories||[],quiet_start:p.quiet_start,quiet_end:p.quiet_end,sound_enabled:p.sound_enabled!==false});
    }
  },[visibleFor,uid]);
  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const ch=supabase.channel("notif-live").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},payload=>{
      const n=payload.new;if(!n||!visibleFor(n)||seen.current.has(n.id))return;seen.current.add(n.id);
      setList(p=>[n,...p].slice(0,60));
      if(shouldSound(n))beep(n.severity);
      setToast(n);clearTimeout(tt.current);tt.current=setTimeout(()=>setToast(null),7000);
    }).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[visibleFor,shouldSound]);

  const now=Date.now();
  const active=list.filter(n=>{const s=st[n.id];return !(s&&s.snooze_until&&new Date(s.snooze_until).getTime()>now);});
  const unread=active.filter(n=>!(st[n.id]&&st[n.id].read_at)).length;
  useEffect(()=>{setBadge(unread);},[unread]);

  const upsert=async(id,patch)=>{setSt(p=>({...p,[id]:{...(p[id]||{}),...patch}}));
    if(uid)await supabase.from("notification_reads").upsert({notification_id:id,user_id:uid,...patch},{onConflict:"notification_id,user_id"});};
  const markRead=n=>{if(!(st[n.id]&&st[n.id].read_at))upsert(n.id,{read_at:new Date().toISOString()});};
  const markAll=async()=>{const un=active.filter(n=>!(st[n.id]&&st[n.id].read_at));const ts=new Date().toISOString();
    setSt(p=>{const c={...p};un.forEach(n=>c[n.id]={...(c[n.id]||{}),read_at:ts});return c;});
    if(uid&&un.length)await supabase.from("notification_reads").upsert(un.map(n=>({notification_id:n.id,user_id:uid,read_at:ts})),{onConflict:"notification_id,user_id"});};
  const ack=(n,e)=>{e&&e.stopPropagation();const ts=new Date().toISOString();upsert(n.id,{read_at:ts,ack_at:ts});};
  const snooze=(n,hrs,e)=>{e&&e.stopPropagation();upsert(n.id,{snooze_until:new Date(Date.now()+hrs*3600000).toISOString()});if(toast&&toast.id===n.id)setToast(null);};
  const go=n=>{markRead(n);setOpen(false);setToast(null);if(n.module&&onNav)onNav(n.module);};
  const waLink=n=>`https://wa.me/${OWNER_WA}?text=`+encodeURIComponent(`🔴 تنبيه حرِج — دلو ورغوة\n${n.title}\n${n.body||""}`);

  const savePrefs=async(np)=>{setPrefs(np);if(uid)await supabase.from("notification_prefs").upsert({user_id:uid,muted_categories:np.muted_categories,quiet_start:np.quiet_start,quiet_end:np.quiet_end,sound_enabled:np.sound_enabled,updated_at:new Date().toISOString()},{onConflict:"user_id"});};
  const toggleCat=c=>{const m=prefs.muted_categories||[];savePrefs({...prefs,muted_categories:m.includes(c)?m.filter(x=>x!==c):[...m,c]});};
  const soundOff=!prefs.sound_enabled;

  const row=(n,inToast)=>{const s=SEV[n.severity]||SEV.info;const isr=st[n.id]&&st[n.id].read_at;const isa=st[n.id]&&st[n.id].ack_at;return(
    <div key={n.id} className={"nt-item"+(isr?"":" un")} onClick={()=>go(n)}>
      <span className="nt-ic" style={{background:s.bg,color:s.c}}><Icon n={s.ic} s={15}/></span>
      <div className="nt-txt"><b>{n.title}</b>{n.body&&<span>{n.body}</span>}
        <div className="nt-meta"><small>{CAT_AR[n.category]||n.category} · {timeAgo(n.created_at)}</small></div>
        {!inToast&&<div className="nt-btns" onClick={e=>e.stopPropagation()}>
          {!isa&&<button onClick={e=>ack(n,e)}><Icon n="check" s={12}/> إقرار</button>}
          {isa&&<span className="nt-ackd"><Icon n="check" s={11}/> مُقَرّ</span>}
          <button onClick={e=>snooze(n,1,e)}>تأجيل 1س</button>
          <button onClick={e=>snooze(n,3,e)}>3س</button>
          {n.severity==="crit"&&<a href={waLink(n)} target="_blank" rel="noreferrer" className="nt-wa" onClick={e=>e.stopPropagation()}><Icon n="phone" s={12}/> واتساب</a>}
        </div>}
      </div>
      {!isr&&<span className="nt-dot" style={{background:s.c}}/>}
    </div>);};

  return(<>
    <style>{CSS}</style>
    <div className="nt-wrap">
      <button className="nt-bell" onClick={()=>{setOpen(o=>!o);setCfg(false);}} title="الإشعارات">
        <Icon n="bell" s={18}/>{unread>0&&<span className="nt-badge">{unread>9?"9+":unread}</span>}
      </button>
      {open&&<>
        <div className="nt-scrim" onClick={()=>setOpen(false)}/>
        <div className="nt-panel">
          <div className="nt-head">
            <b>الإشعارات {unread>0&&<span className="nt-cnt">{unread}</span>}</b>
            <div className="nt-actions">
              <button onClick={()=>savePrefs({...prefs,sound_enabled:soundOff})} title={soundOff?"تشغيل الصوت":"كتم الصوت"} className={soundOff?"muted":""}><Icon n={soundOff?"x":"bell"} s={14}/></button>
              <button onClick={()=>setCfg(c=>!c)} title="التفضيلات" className={cfg?"on":""}><Icon n="wrench" s={14}/></button>
              {unread>0&&<button onClick={markAll} title="تعليم الكل مقروء"><Icon n="check" s={14}/></button>}
            </div>
          </div>
          {cfg?<div className="nt-cfg">
            <div className="nt-cfg-r"><span>الصوت</span><button className={"nt-sw"+(prefs.sound_enabled?" on":"")} onClick={()=>savePrefs({...prefs,sound_enabled:!prefs.sound_enabled})}><i/></button></div>
            <div className="nt-cfg-q"><span>ساعات الهدوء (لا صوت)</span>
              <div className="nt-qh">
                <input type="number" min="0" max="23" placeholder="من" value={prefs.quiet_start??""} onChange={e=>savePrefs({...prefs,quiet_start:e.target.value===""?null:Math.max(0,Math.min(23,+e.target.value))})}/>
                <span>→</span>
                <input type="number" min="0" max="23" placeholder="إلى" value={prefs.quiet_end??""} onChange={e=>savePrefs({...prefs,quiet_end:e.target.value===""?null:Math.max(0,Math.min(23,+e.target.value))})}/>
                <small>بتوقيت الرياض</small>
              </div>
            </div>
            <div className="nt-cfg-t">كتم فئات معيّنة</div>
            <div className="nt-cats">{CATS.map(([k,ar])=>{const off=(prefs.muted_categories||[]).includes(k);return(
              <button key={k} className={"nt-cat"+(off?" off":"")} onClick={()=>toggleCat(k)}>{off?"🔕":"🔔"} {ar}</button>);})}</div>
            <p className="nt-cfg-n">الكتم يوقف الصوت فقط — تبقى الإشعارات ظاهرة في القائمة.</p>
          </div>:
          <div className="nt-list">
            {active.length===0&&<div className="nt-empty"><Icon n="inbox" s={26}/><p>لا إشعارات</p></div>}
            {active.map(n=>row(n,false))}
          </div>}
        </div>
      </>}
    </div>

    {toast&&(()=>{const s=SEV[toast.severity]||SEV.info;return(
      <div className="nt-toast" style={{borderInlineStartColor:s.c}} onClick={()=>go(toast)}>
        <span className="nt-ic" style={{background:s.bg,color:s.c}}><Icon n={s.ic} s={16}/></span>
        <div className="nt-txt"><b>{toast.title}</b>{toast.body&&<span>{toast.body}</span>}
          <div className="nt-btns" onClick={e=>e.stopPropagation()}>
            <button onClick={e=>ack(toast,e)}><Icon n="check" s={12}/> إقرار</button>
            <button onClick={e=>snooze(toast,1,e)}>تأجيل</button>
            {toast.severity==="crit"&&<a href={waLink(toast)} target="_blank" rel="noreferrer" className="nt-wa" onClick={e=>e.stopPropagation()}><Icon n="phone" s={12}/> واتساب</a>}
          </div>
        </div>
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
.nt-panel{position:absolute;inset-inline-end:0;top:48px;width:352px;max-width:90vw;max-height:74vh;background:#fff;border:1px solid #e6e9ee;border-radius:16px;box-shadow:0 16px 48px rgba(16,24,40,.22);z-index:81;display:flex;flex-direction:column;overflow:hidden}
.nt-head{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid #eceef1}
.nt-head b{font-size:14px;font-weight:800;display:flex;align-items:center;gap:7px}
.nt-cnt{background:#f04438;color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px}
.nt-actions{display:flex;gap:6px}
.nt-actions button{width:30px;height:30px;border-radius:8px;border:1px solid #e6e9ee;background:#fff;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center}
.nt-actions button.muted{background:#feecea;color:#b42318;border-color:#f7bfba}
.nt-actions button.on{background:#fff2e8;color:#c2410c;border-color:#f5c9a8}
.nt-list{overflow-y:auto}
.nt-item{display:flex;gap:11px;align-items:flex-start;padding:12px 14px;border-bottom:1px solid #f4f5f7;cursor:pointer;position:relative}
.nt-item:hover{background:#fafbfc}.nt-item.un{background:#fbfdff}
.nt-ic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.nt-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.nt-txt b{font-size:12.5px;font-weight:800;color:#0f172a;line-height:1.4}
.nt-txt>span{font-size:11.5px;color:#475569;line-height:1.5}
.nt-meta small{font-size:10px;color:#94a3b8}
.nt-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
.nt-btns button,.nt-wa{font-size:10.5px;font-weight:700;border:1px solid #e6e9ee;background:#fff;color:#475569;border-radius:8px;padding:4px 9px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;text-decoration:none}
.nt-btns button:hover{background:#f1f5f9}
.nt-wa{background:#e7f7ef;color:#087443;border-color:#b7e4cd}
.nt-ackd{font-size:10.5px;font-weight:800;color:#087443;display:inline-flex;align-items:center;gap:4px}
.nt-dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:5px}
.nt-empty{text-align:center;color:#cbd5e1;padding:34px 0}.nt-empty p{color:#94a3b8;font-size:12.5px;margin-top:8px}
.nt-cfg{padding:14px 15px;overflow-y:auto}
.nt-cfg-r,.nt-cfg-q{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;font-size:12.5px;font-weight:700;color:#334155;flex-wrap:wrap}
.nt-sw{width:42px;height:24px;border-radius:20px;border:none;background:#cbd5e1;position:relative;cursor:pointer;flex:none}
.nt-sw.on{background:#12b76a}.nt-sw i{position:absolute;top:3px;inset-inline-start:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}
.nt-sw.on i{inset-inline-start:21px}
.nt-qh{display:flex;align-items:center;gap:7px}
.nt-qh input{width:52px;border:1px solid #e6e9ee;border-radius:8px;padding:6px 8px;font-family:inherit;font-size:12px;text-align:center}
.nt-qh small{font-size:10px;color:#94a3b8}
.nt-cfg-t{font-size:11.5px;font-weight:800;color:#64748b;margin:6px 0 8px}
.nt-cats{display:flex;flex-wrap:wrap;gap:6px}
.nt-cat{font-size:11px;font-weight:700;border:1px solid #e6e9ee;background:#fff;color:#334155;border-radius:20px;padding:5px 11px;cursor:pointer}
.nt-cat.off{background:#f1f3f5;color:#94a3b8}
.nt-cfg-n{font-size:10.5px;color:#94a3b8;margin-top:10px;line-height:1.6}
.nt-toast{position:fixed;inset-block-start:16px;inset-inline-start:16px;z-index:200;width:340px;max-width:90vw;background:#fff;border:1px solid #e6e9ee;border-inline-start-width:4px;border-radius:13px;box-shadow:0 12px 40px rgba(16,24,40,.25);padding:12px 13px;display:flex;gap:11px;align-items:flex-start;cursor:pointer;animation:ntin .25s ease}
@keyframes ntin{from{transform:translateY(-12px);opacity:0}to{transform:translateY(0);opacity:1}}
.nt-toast .nt-txt b{font-size:13px}.nt-toast .nt-txt>span{font-size:11.5px}
.nt-x{border:none;background:transparent;color:#94a3b8;cursor:pointer;flex:none;padding:2px}
@media(max-width:520px){.nt-toast{inset-inline:10px;width:auto}}
@media print{.nt-wrap,.nt-toast{display:none}}
`;
