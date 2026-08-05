import{useState,useEffect}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";

const waNum=raw=>{let d=String(raw||"").replace(/[^0-9]/g,"");if(!d)return"";if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("966")||d.startsWith("880"))return d;if(d.startsWith("0"))return(d.length===11?"880":"966")+d.replace(/^0+/,"");if(d.startsWith("5")&&d.length===9)return"966"+d;if(d.startsWith("1")&&d.length===10)return"880"+d;return d;};

// شاشة «فريقي» — يراها المشرف الميداني/مدير التشغيل: فرقه وأعضاؤها.
// تعتمد على سياسات RLS: teams_sup_read (فرق المشرف) + employees_sup_select (أعضاء فرقه).
export default function MyTeam(){
  const[loading,setLoading]=useState(true);
  const[teams,setTeams]=useState([]);
  const[emps,setEmps]=useState([]);

  useEffect(()=>{(async()=>{
    setLoading(true);
    const{data:tm}=await supabase.from("teams").select("*").order("created_at");
    const ts=tm||[];setTeams(ts);
    if(ts.length){
      const{data:e}=await supabase.from("employees").select("id,full_name,mobile,employee_id,team_id").in("team_id",ts.map(t=>t.id));
      setEmps(e||[]);
    }
    setLoading(false);
  })();},[]);

  if(loading)return <div className="dw-skel" style={{height:220}}/>;

  const total=emps.length;
  return(<div className="mt">
    <style>{CSS}</style>
    <div className="mt-kpis">
      <div className="mt-kpi"><span className="mt-ki" style={{background:"#fff2e8",color:"#E8712B"}}><Icon n="bike" s={17}/></span><div><div className="mt-kv">{total}</div><div className="mt-kl">إجمالي البايكرز</div></div></div>
      <div className="mt-kpi"><span className="mt-ki" style={{background:"#eef4ff",color:"#1d5bbf"}}><Icon n="performance" s={17}/></span><div><div className="mt-kv">{teams.length}</div><div className="mt-kl">فرقي</div></div></div>
    </div>

    {teams.length===0?<div className="mt-empty"><div className="mt-empty-ic"><Icon n="bike" s={30}/></div><h3>لا فرق مُسندة إليك بعد</h3><p>حين يُسند إليك المالك فريقاً، سيظهر هنا مع بيانات أعضائه.</p></div>:
    teams.map(t=>{const mem=emps.filter(e=>e.team_id===t.id);return(
      <div className="mt-team" key={t.id}>
        <div className="mt-team-h"><span className="mt-team-ic"><Icon n="performance" s={15}/></span><b>{t.name}</b><span className="mt-cnt">{mem.length} بايكر</span></div>
        {mem.length===0?<div className="mt-none">لا أعضاء في هذا الفريق بعد</div>:
        <div className="mt-list">{mem.map(e=>{const isLead=t.leader_employee_id===e.id;return(
          <div className="mt-mem" key={e.id}>
            <div className="mt-av">{(e.full_name||"?").trim().charAt(0)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="mt-name">{e.full_name}{isLead&&<span className="mt-lead">قائد</span>}</div>
              <div className="mt-sub">{e.employee_id?`#${e.employee_id} · `:""}<span dir="ltr">{e.mobile||"—"}</span></div>
            </div>
            {e.mobile&&<a className="mt-wa" href={`https://wa.me/${waNum(e.mobile)}`} target="_blank" rel="noreferrer"><Icon n="phone" s={15}/></a>}
          </div>);})}</div>}
      </div>);})}
  </div>);
}

const CSS=`
.mt{--b:#E8712B}
.mt-kpis{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.mt-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.mt-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.mt-kv{font-size:20px;font-weight:800;letter-spacing:-.5px}.mt-kl{font-size:11px;color:#64748b;font-weight:600}
.mt-team{background:#fff;border:1px solid #eceef1;border-radius:16px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.mt-team-h{display:flex;align-items:center;gap:9px;padding:13px 15px;border-bottom:1px solid #f1f3f5;background:#fafbfc}
.mt-team-ic{width:30px;height:30px;border-radius:9px;background:#fff2e8;color:var(--b);display:flex;align-items:center;justify-content:center;flex:none}
.mt-team-h b{font-size:14px;font-weight:800;flex:1}
.mt-cnt{font-size:11px;font-weight:800;color:#64748b;background:#fff;border:1px solid #eceef1;padding:2px 10px;border-radius:20px}
.mt-list{padding:8px 10px}
.mt-mem{display:flex;align-items:center;gap:11px;padding:9px 8px;border-bottom:1px solid #f6f7f9}
.mt-mem:last-child{border-bottom:none}
.mt-av{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex:none}
.mt-name{font-size:13px;font-weight:800;color:#0f172a}
.mt-lead{font-size:9.5px;font-weight:800;background:#fff2e8;color:#b54708;padding:1px 8px;border-radius:20px;margin-inline-start:6px}
.mt-sub{font-size:11.5px;color:#94a3b8;margin-top:1px}
.mt-wa{width:36px;height:36px;border-radius:11px;background:#e7f7ef;color:#087443;display:flex;align-items:center;justify-content:center;flex:none;text-decoration:none}
.mt-none{padding:14px;text-align:center;color:#94a3b8;font-size:12.5px}
.mt-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:40px 24px;text-align:center}
.mt-empty-ic{width:64px;height:64px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.mt-empty h3{font-size:16px;margin:0 0 8px}.mt-empty p{color:#64748b;font-size:12.5px;max-width:420px;margin:0 auto;line-height:1.7}
`;
