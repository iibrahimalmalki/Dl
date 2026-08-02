import{useState,useEffect,useMemo}from"react";
import{supabase}from"./supabase";
import Icon from"./Icon";
import{ITEM_CATS,CAT_ICON,REQ_TYPES,REQ_STATUS,APPROVAL_THRESHOLD,needsCeo,STANDARD_KIT,money}from"./supplyPolicy";

const fmtD=d=>d?new Date(d).toLocaleDateString("en-GB"):"—";
const today=()=>new Date().toISOString().slice(0,10);

export default function Supply({owner,opId}){
  const[tab,setTab]=useState("stock");
  const[loading,setLoading]=useState(true);
  const[items,setItems]=useState([]);const[reqs,setReqs]=useState([]);const[reqItems,setReqItems]=useState([]);
  const[cust,setCust]=useState([]);const[takes,setTakes]=useState([]);const[emps,setEmps]=useState([]);const[vendors,setVendors]=useState([]);
  const[uid,setUid]=useState(null);const[msg,setMsg]=useState(null);const[busy,setBusy]=useState(false);
  const note=(ok,t)=>setMsg({ok,t});

  const load=async()=>{
    setLoading(true);
    const opF=q=>opId&&opId!=="all"?q.eq("operator_id",opId):q;
    const[it,rq,ri,cu,tk,em,vn]=await Promise.all([
      opF(supabase.from("sc_items").select("*").order("category")).then(r=>r.data||[]),
      opF(supabase.from("sc_requests").select("*").order("seq",{ascending:false})).then(r=>r.data||[]),
      supabase.from("sc_request_items").select("*").then(r=>r.data||[]),
      opF(supabase.from("sc_custody").select("*").order("assigned_at",{ascending:false})).then(r=>r.data||[]),
      opF(supabase.from("sc_stocktakes").select("*").order("created_at",{ascending:false})).then(r=>r.data||[]),
      supabase.from("employees").select("id,full_name,employee_id,staff_role").then(r=>(r.data||[]).filter(e=>e.staff_role!=="manager")),
      supabase.from("vendors").select("id,name").then(r=>r.data||[]),
    ]);
    setItems(it);setReqs(rq);setReqItems(ri);setCust(cu);setTakes(tk);setEmps(em);setVendors(vn);
    setLoading(false);
  };
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUid(data.user&&data.user.id));},[]);
  useEffect(()=>{load();/*eslint-disable-next-line*/},[opId]);

  if(loading)return <div className="dw-skel" style={{height:280}}/>;
  const op=(opId&&opId!=="all")?opId:null;
  const ctx={items,reqs,reqItems,cust,takes,emps,vendors,uid,owner,op,busy,setBusy,note,load};

  return(<div className="sp">
    <style>{CSS}</style>
    <div className="sp-tabs">
      {[["stock","المخزون","operations"],["req","الطلبات","doc"],["cust","العُهد","id"],["take","الجرد","check"]].map(([k,ar,ic])=>(
        <button key={k} className={tab===k?"on":""} onClick={()=>{setTab(k);setMsg(null);}}><Icon n={ic} s={15}/> {ar}</button>))}
    </div>
    {msg&&<div className={"sp-msg "+(msg.ok?"ok":"err")}>{msg.t}</div>}
    {tab==="stock"&&<Stock {...ctx}/>}
    {tab==="req"&&<Requests {...ctx}/>}
    {tab==="cust"&&<Custody {...ctx}/>}
    {tab==="take"&&<Stocktake {...ctx}/>}
  </div>);
}

/* ═══ المخزون ═══ */
function Stock({items,op,note,load}){
  const[filter,setFilter]=useState("all");const[form,setForm]=useState(null);const[adj,setAdj]=useState(null);
  const kpis=useMemo(()=>{
    const low=items.filter(i=>i.active&&Number(i.qty_on_hand)<=Number(i.reorder_level||0)&&Number(i.reorder_level||0)>0).length;
    const value=items.reduce((a,i)=>a+Number(i.qty_on_hand||0)*Number(i.unit_cost||0),0);
    return{count:items.length,low,value};
  },[items]);
  const shown=items.filter(i=>filter==="all"||i.category===filter);

  const save=async()=>{
    if(!form.name.trim()){note(false,"أدخل اسم الصنف");return;}
    const row={operator_id:op,name:form.name.trim(),category:form.category||null,sku:form.sku||null,unit:form.unit||"قطعة",reorder_level:Number(form.reorder_level||0),unit_cost:Number(form.unit_cost||0),custody:!!form.custody,notes:form.notes||null,active:form.active!==false};
    if(form.id)await supabase.from("sc_items").update(row).eq("id",form.id);
    else{row.qty_on_hand=Number(form.qty_on_hand||0);const{data}=await supabase.from("sc_items").insert(row).select("id").single();
      if(row.qty_on_hand>0&&data)await supabase.from("sc_moves").insert({operator_id:op,item_id:data.id,kind:"in",qty:row.qty_on_hand,ref_type:"manual",note:"رصيد افتتاحي"});}
    setForm(null);note(true,"تم الحفظ");await load();
  };
  const doAdj=async()=>{
    const delta=Number(adj.delta);if(!delta){setAdj(null);return;}
    await supabase.from("sc_moves").insert({operator_id:op,item_id:adj.item.id,kind:"adjust",qty:delta,ref_type:"manual",note:adj.note||"تسوية يدوية"});
    setAdj(null);note(true,"تم تعديل الرصيد");await load();
  };

  return(<div>
    <div className="sp-kpis">
      <K ic="operations" c="#E8712B" bg="#fff2e8" t="الأصناف" v={kpis.count}/>
      <K ic="alert" c="#b42318" bg="#feecea" t="تحت حدّ الطلب" v={kpis.low}/>
      <K ic="cash" c="#087443" bg="#e7f7ef" t="قيمة المخزون" v={money(kpis.value)}/>
    </div>
    <div className="sp-bar">
      <div className="sp-filters"><button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>الكل</button>{ITEM_CATS.map(c=><button key={c} className={filter===c?"on":""} onClick={()=>setFilter(c)}>{c}</button>)}</div>
      <button className="sp-add" onClick={()=>setForm({name:"",category:"",unit:"قطعة",sku:"",qty_on_hand:0,reorder_level:0,unit_cost:0,custody:false,active:true})}><Icon n="plus" s={15}/> صنف جديد</button>
    </div>
    {shown.length===0?<Empty ic="operations" t="لا أصناف بعد" s="أضف أصناف المخزون (معدات الغسيل، الزي، معدات السلامة، القطع…)."/>:
    <div className="sp-list">{shown.map(i=>{const low=Number(i.qty_on_hand)<=Number(i.reorder_level||0)&&Number(i.reorder_level||0)>0;return(
      <div className="sp-item" key={i.id}>
        <div className="sp-av"><Icon n={CAT_ICON[i.category]||"vendors"} s={16}/></div>
        <div style={{flex:1,minWidth:0}}><div className="sp-name">{i.name}{i.custody&&<span className="sp-tag">عُهدة</span>}{!i.active&&<span className="sp-tag off">موقوف</span>}</div><div className="sp-sub">{i.category||"—"}{i.sku?` · ${i.sku}`:""} · حدّ الطلب {Number(i.reorder_level||0)}</div></div>
        <div className="sp-qtybox"><span className={"sp-qty"+(low?" low":"")}>{Number(i.qty_on_hand)}</span><small>{i.unit}</small></div>
        <div className="sp-iact"><button onClick={()=>setAdj({item:i,delta:"",note:""})} title="تسوية رصيد"><Icon n="refresh" s={13}/></button><button onClick={()=>setForm({...i})} title="تعديل"><Icon n="edit" s={13}/></button></div>
      </div>);})}</div>}

    {form&&<Modal title={form.id?"تعديل صنف":"صنف جديد"} onClose={()=>setForm(null)}>
      <F l="اسم الصنف"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></F>
      <div className="sp-g2"><F l="الفئة"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">—</option>{ITEM_CATS.map(c=><option key={c}>{c}</option>)}</select></F><F l="الوحدة"><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></F></div>
      <div className="sp-g2"><F l="رمز (SKU)"><input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})}/></F><F l="سعر الوحدة"><input type="number" value={form.unit_cost} onChange={e=>setForm({...form,unit_cost:e.target.value})}/></F></div>
      <div className="sp-g2">{!form.id&&<F l="رصيد افتتاحي"><input type="number" value={form.qty_on_hand} onChange={e=>setForm({...form,qty_on_hand:e.target.value})}/></F>}<F l="حدّ إعادة الطلب"><input type="number" value={form.reorder_level} onChange={e=>setForm({...form,reorder_level:e.target.value})}/></F></div>
      <label className="sp-chk"><input type="checkbox" checked={!!form.custody} onChange={e=>setForm({...form,custody:e.target.checked})}/> صنف عُهدة (يُسلَّم للبايكر)</label>
      <label className="sp-chk"><input type="checkbox" checked={form.active!==false} onChange={e=>setForm({...form,active:e.target.checked})}/> صنف نشط</label>
      <div className="sp-mact"><button className="sp-b brand" onClick={save}><Icon n="save" s={14}/> حفظ</button><button className="sp-b ghost" onClick={()=>setForm(null)}>إلغاء</button></div>
    </Modal>}
    {adj&&<Modal title={"تسوية رصيد — "+adj.item.name} onClose={()=>setAdj(null)}>
      <p className="sp-hint">الرصيد الحالي: <b>{Number(adj.item.qty_on_hand)}</b> {adj.item.unit}. أدخل قيمة الفرق (موجب للإضافة، سالب للخصم).</p>
      <F l="الفرق (±)"><input type="number" value={adj.delta} onChange={e=>setAdj({...adj,delta:e.target.value})} placeholder="مثال: 5 أو -3"/></F>
      <F l="السبب"><input value={adj.note} onChange={e=>setAdj({...adj,note:e.target.value})} placeholder="تالف / فرق جرد / …"/></F>
      <div className="sp-mact"><button className="sp-b brand" onClick={doAdj}><Icon n="save" s={14}/> تطبيق</button><button className="sp-b ghost" onClick={()=>setAdj(null)}>إلغاء</button></div>
    </Modal>}
  </div>);
}

/* ═══ الطلبات ═══ */
function Requests({items,reqs,reqItems,vendors,uid,op,owner,note,load}){
  const[form,setForm]=useState(null);const[view,setView]=useState(null);
  const itemsOf=id=>reqItems.filter(r=>r.request_id===id);
  const total=r=>{const li=itemsOf(r.id);const s=li.reduce((a,x)=>a+Number(x.qty||0)*Number(x.unit_cost||0),0);return s||Number(r.quote_amount||0);};

  const submit=async()=>{
    if(!form.title.trim()){note(false,"أدخل وصف الطلب");return;}
    const lines=(form.lines||[]).filter(l=>l.name&&Number(l.qty)>0);
    const amt=lines.reduce((a,l)=>a+Number(l.qty)*Number(l.unit_cost||0),0)||Number(form.quote_amount||0);
    const ceo=needsCeo(form.req_type,amt,form.category);
    const seq=(reqs.reduce((m,r)=>Math.max(m,Number(r.seq||0)),0))+1;
    const row={operator_id:op,seq,req_type:form.req_type,dept:form.dept||null,category:form.category||null,title:form.title.trim(),vendor_id:form.vendor_id||null,quote_amount:amt,need_ceo:ceo,status:ceo?"submitted":"approved",requester_user_id:uid,approver_user_id:ceo?null:uid,decided_at:ceo?null:new Date().toISOString(),notes:form.notes||null};
    const{data,error}=await supabase.from("sc_requests").insert(row).select("id").single();
    if(error){note(false,"خطأ: "+error.message);return;}
    if(lines.length)await supabase.from("sc_request_items").insert(lines.map(l=>({request_id:data.id,item_id:l.item_id||null,name:l.name,qty:Number(l.qty),unit_cost:Number(l.unit_cost||0)})));
    setForm(null);note(true,ceo?"رُفع الطلب لاعتماد الرئيس":"طلب صغير — اعتُمد تلقائياً، جاهز للاستلام");await load();
  };
  const decide=async(r,ok)=>{await supabase.from("sc_requests").update({status:ok?"approved":"rejected",approver_user_id:uid,decided_at:new Date().toISOString()}).eq("id",r.id);note(true,ok?"تم الاعتماد":"تم الرفض");await load();};
  const receive=async(r)=>{
    const li=itemsOf(r.id);
    for(const l of li){if(!l.item_id)continue;const kind=r.req_type==="صرف"?"out":"in";await supabase.from("sc_moves").insert({operator_id:op,item_id:l.item_id,kind,qty:Number(l.qty),ref_type:"request",ref_id:r.id,note:`طلب #${r.seq}`});}
    await supabase.from("sc_requests").update({status:"received",received_at:new Date().toISOString()}).eq("id",r.id);
    note(true,r.req_type==="صرف"?"تم الصرف من المخزون":"تم الاستلام وإضافته للمخزون");await load();
  };

  const liveCeo=form?needsCeo(form.req_type,(form.lines||[]).reduce((a,l)=>a+Number(l.qty||0)*Number(l.unit_cost||0),0)||Number(form.quote_amount||0),form.category):false;

  return(<div>
    <div className="sp-bar"><div style={{flex:1,fontSize:12.5,color:"#64748b",fontWeight:700}}>سلسلة الاعتماد: طلب ← عرض سعر ← مراجعة ← اعتماد الرئيس (فوق {APPROVAL_THRESHOLD} ﷼ أو الدراجات/الصيانة)</div>
      <button className="sp-add" onClick={()=>setForm({req_type:"شراء",dept:"",category:"",title:"",vendor_id:"",quote_amount:"",notes:"",lines:[]})}><Icon n="plus" s={15}/> طلب جديد</button></div>

    {reqs.length===0?<Empty ic="doc" t="لا طلبات بعد" s="أنشئ طلب شراء أو صيانة أو صرف من المخزون."/>:
    <div className="sp-list">{reqs.map(r=>{const st=REQ_STATUS[r.status]||REQ_STATUS.submitted;return(
      <div className="sp-req" key={r.id}>
        <div className="sp-req-top" onClick={()=>setView(view===r.id?null:r.id)}>
          <span className="sp-seq">#{r.seq}</span>
          <div style={{flex:1,minWidth:0}}><div className="sp-name">{r.title}<span className="sp-type">{r.req_type}</span></div><div className="sp-sub">{r.dept||"—"}{r.category?` · ${r.category}`:""} · {money(total(r))}{r.need_ceo?" · يحتاج اعتماد الرئيس":""}</div></div>
          <span className="sp-badge" style={{background:st.bg,color:st.c}}>{st.ar}</span>
        </div>
        {view===r.id&&<div className="sp-req-b">
          {itemsOf(r.id).length>0&&<div className="sp-reqitems">{itemsOf(r.id).map(l=><div className="sp-ri" key={l.id}><span>{l.name}</span><span>{Number(l.qty)} × {money(l.unit_cost)}</span></div>)}</div>}
          {r.notes&&<div className="sp-hint" style={{margin:"8px 0"}}>{r.notes}</div>}
          <div className="sp-reqact">
            {r.status==="submitted"&&owner&&<><button className="sp-b ok" onClick={()=>decide(r,true)}><Icon n="check" s={13}/> اعتماد</button><button className="sp-b danger" onClick={()=>decide(r,false)}><Icon n="x" s={13}/> رفض</button></>}
            {r.status==="approved"&&<button className="sp-b brand" onClick={()=>receive(r)}><Icon n="download" s={13}/> {r.req_type==="صرف"?"صرف من المخزون":"تأكيد الاستلام"}</button>}
            {r.status==="submitted"&&!owner&&<span className="sp-wait">بانتظار اعتماد الرئيس</span>}
          </div>
        </div>}
      </div>);})}</div>}

    {form&&<Modal title="طلب جديد" onClose={()=>setForm(null)}>
      <div className="sp-g2"><F l="النوع"><select value={form.req_type} onChange={e=>setForm({...form,req_type:e.target.value})}>{REQ_TYPES.map(t=><option key={t}>{t}</option>)}</select></F><F l="الفئة"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">—</option>{ITEM_CATS.map(c=><option key={c}>{c}</option>)}</select></F></div>
      <F l="الوصف"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="مثال: صيانة دراجة #12 / شراء مناشف"/></F>
      <div className="sp-g2"><F l="الإدارة الطالبة"><input value={form.dept} onChange={e=>setForm({...form,dept:e.target.value})} placeholder="التشغيل الميداني"/></F><F l="المورد"><select value={form.vendor_id} onChange={e=>setForm({...form,vendor_id:e.target.value})}><option value="">—</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></F></div>
      {/* بنود مرتبطة بالمخزون */}
      <div className="sp-lines-h">بنود المخزون (اختياري — للشراء/الصرف)<button onClick={()=>setForm({...form,lines:[...(form.lines||[]),{item_id:"",name:"",qty:1,unit_cost:0}]})}><Icon n="plus" s={12}/> بند</button></div>
      {(form.lines||[]).map((l,idx)=>(<div className="sp-line" key={idx}>
        <select value={l.item_id} onChange={e=>{const it=items.find(x=>x.id===e.target.value);const ls=[...form.lines];ls[idx]={...l,item_id:e.target.value,name:it?it.name:l.name,unit_cost:it?it.unit_cost:l.unit_cost};setForm({...form,lines:ls});}}><option value="">صنف/يدوي…</option>{items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}</select>
        <input placeholder="اسم" value={l.name} onChange={e=>{const ls=[...form.lines];ls[idx]={...l,name:e.target.value};setForm({...form,lines:ls});}}/>
        <input type="number" placeholder="كمية" value={l.qty} onChange={e=>{const ls=[...form.lines];ls[idx]={...l,qty:e.target.value};setForm({...form,lines:ls});}}/>
        <input type="number" placeholder="سعر" value={l.unit_cost} onChange={e=>{const ls=[...form.lines];ls[idx]={...l,unit_cost:e.target.value};setForm({...form,lines:ls});}}/>
        <button className="sp-linex" onClick={()=>{const ls=form.lines.filter((_,i)=>i!==idx);setForm({...form,lines:ls});}}><Icon n="x" s={12}/></button>
      </div>))}
      <F l="قيمة عرض السعر (إن لم توجد بنود)"><input type="number" value={form.quote_amount} onChange={e=>setForm({...form,quote_amount:e.target.value})} placeholder="0"/></F>
      <div className={"sp-route "+(liveCeo?"ceo":"auto")}><Icon n={liveCeo?"lock":"check"} s={13}/> {liveCeo?"سيُرفع لاعتماد الرئيس التنفيذي":"ضمن صلاحية اللوجستي — يُعتمد تلقائياً"}</div>
      <div className="sp-mact"><button className="sp-b brand" onClick={submit}><Icon n="save" s={14}/> إرسال الطلب</button><button className="sp-b ghost" onClick={()=>setForm(null)}>إلغاء</button></div>
    </Modal>}
  </div>);
}

/* ═══ العُهد ═══ */
function Custody({items,cust,emps,op,note,load}){
  const[assign,setAssign]=useState(null);
  const active=cust.filter(c=>c.status==="assigned");
  const byBiker=useMemo(()=>{const m={};active.forEach(c=>{const k=c.employee_id||c.biker_name;(m[k]=m[k]||{name:c.biker_name,emp:c.employee_id,rows:[]}).rows.push(c);});return Object.values(m);},[active]);
  const findItem=name=>items.find(i=>i.name.trim()===String(name).trim());

  const doAssign=async()=>{
    const emp=emps.find(e=>e.id===assign.emp);if(!emp){note(false,"اختر البايكر");return;}
    let lines=[];
    if(assign.mode==="kit")lines=STANDARD_KIT.map(k=>({name:k.name,qty:k.qty}));
    else lines=[{name:assign.name,qty:Number(assign.qty||1),item_id:assign.item_id}];
    lines=lines.filter(l=>l.name&&Number(l.qty)>0);
    if(!lines.length){note(false,"لا بنود للتسليم");return;}
    for(const l of lines){
      const it=l.item_id?items.find(x=>x.id===l.item_id):findItem(l.name);
      await supabase.from("sc_custody").insert({operator_id:op,employee_id:emp.id,biker_name:emp.full_name,item_id:it?it.id:null,item_name:l.name,qty:Number(l.qty),status:"assigned",form_ref:"FRM-OPS-001"});
      if(it)await supabase.from("sc_moves").insert({operator_id:op,item_id:it.id,kind:"out",qty:Number(l.qty),ref_type:"custody",note:`عهدة ${emp.full_name}`});
    }
    setAssign(null);note(true,"تم تسليم العهدة وتوقيعها (FRM-OPS-001)");await load();
  };
  const ret=async(c,lost)=>{
    await supabase.from("sc_custody").update({status:lost?"lost":"returned",returned_at:new Date().toISOString()}).eq("id",c.id);
    if(!lost&&c.item_id)await supabase.from("sc_moves").insert({operator_id:op,item_id:c.item_id,kind:"in",qty:Number(c.qty),ref_type:"custody",note:`إرجاع عهدة ${c.biker_name}`});
    note(true,lost?"سُجّل كمفقود":"تم إرجاع العهدة للمخزون");await load();
  };

  return(<div>
    <div className="sp-bar"><div style={{flex:1,fontSize:12.5,color:"#64748b",fontWeight:700}}><Icon n="doc" s={13}/> تسليم المعدات وفق نموذج FRM-OPS-001 · {active.length} بند مُسلّم</div>
      <button className="sp-add" onClick={()=>setAssign({emp:"",mode:"kit",name:"",qty:1,item_id:""})}><Icon n="plus" s={15}/> تسليم عهدة</button></div>
    {byBiker.length===0?<Empty ic="id" t="لا عُهد مُسلّمة بعد" s="سلّم قائمة التجهيز القياسية لبايكر جديد بضغطة، أو صنفاً مفرداً."/>:
    <div className="sp-cust">{byBiker.map((b,i)=>(
      <div className="sp-cust-card" key={i}>
        <div className="sp-cust-h"><div className="sp-cust-av">{(b.name||"?").trim().charAt(0)}</div><b>{b.name}</b><span className="sp-cust-cnt">{b.rows.length} بند</span></div>
        <div className="sp-cust-items">{b.rows.map(c=>(
          <div className="sp-cust-it" key={c.id}><span className="sp-cust-nm">{c.item_name} {c.qty>1?`×${c.qty}`:""}{!c.item_id&&<i className="sp-out">خارج المخزون</i>}</span>
            <div className="sp-cust-a"><button onClick={()=>ret(c,false)} title="إرجاع للمخزون"><Icon n="back" s={12}/></button><button className="lost" onClick={()=>ret(c,true)} title="فقد"><Icon n="alert" s={12}/></button></div></div>))}</div>
      </div>))}</div>}

    {assign&&<Modal title="تسليم عهدة — FRM-OPS-001" onClose={()=>setAssign(null)}>
      <F l="البايكر"><select value={assign.emp} onChange={e=>setAssign({...assign,emp:e.target.value})}><option value="">اختر…</option>{emps.map(e=><option key={e.id} value={e.id}>{e.full_name}{e.employee_id?` · #${e.employee_id}`:""}</option>)}</select></F>
      <div className="sp-modechips"><button className={assign.mode==="kit"?"on":""} onClick={()=>setAssign({...assign,mode:"kit"})}>القائمة القياسية ({STANDARD_KIT.length} بند)</button><button className={assign.mode==="single"?"on":""} onClick={()=>setAssign({...assign,mode:"single"})}>صنف مفرد</button></div>
      {assign.mode==="kit"?<div className="sp-kit">{STANDARD_KIT.map((k,i)=><span key={i} className="sp-kitc">{k.name}{k.qty>1?` ×${k.qty}`:""}</span>)}</div>:
      <div className="sp-g2"><F l="الصنف"><select value={assign.item_id} onChange={e=>{const it=items.find(x=>x.id===e.target.value);setAssign({...assign,item_id:e.target.value,name:it?it.name:assign.name});}}><option value="">اختر/يدوي…</option>{items.map(it=><option key={it.id} value={it.id}>{it.name}</option>)}</select></F><F l="الكمية"><input type="number" value={assign.qty} onChange={e=>setAssign({...assign,qty:e.target.value})}/></F></div>}
      {assign.mode==="single"&&!assign.item_id&&<F l="اسم الصنف (يدوي)"><input value={assign.name} onChange={e=>setAssign({...assign,name:e.target.value})}/></F>}
      <div className="sp-route auto"><Icon n="doc" s={13}/> يُوقّع الطرفان على FRM-OPS-001 ويُخصم المتوفّر من المخزون تلقائياً.</div>
      <div className="sp-mact"><button className="sp-b brand" onClick={doAssign}><Icon n="save" s={14}/> تسليم وتوقيع</button><button className="sp-b ghost" onClick={()=>setAssign(null)}>إلغاء</button></div>
    </Modal>}
  </div>);
}

/* ═══ الجرد ═══ */
function Stocktake({items,takes,op,note,load}){
  const[open,setOpen]=useState(null);const[lines,setLines]=useState([]);
  const start=async()=>{
    const act=items.filter(i=>i.active);
    const{data,error}=await supabase.from("sc_stocktakes").insert({operator_id:op,taken_on:today(),status:"open"}).select("id").single();
    if(error){note(false,"خطأ: "+error.message);return;}
    if(act.length)await supabase.from("sc_stocktake_lines").insert(act.map(i=>({stocktake_id:data.id,item_id:i.id,item_name:i.name,system_qty:Number(i.qty_on_hand||0),counted_qty:null})));
    note(true,"بدأ جرد جديد");await load();openTake(data.id);
  };
  const openTake=async(id)=>{const{data}=await supabase.from("sc_stocktake_lines").select("*").eq("stocktake_id",id);setLines(data||[]);setOpen(id);};
  const setCount=(lid,v)=>setLines(ls=>ls.map(l=>l.id===lid?{...l,counted_qty:v}:l));
  const saveCounts=async()=>{for(const l of lines){await supabase.from("sc_stocktake_lines").update({counted_qty:l.counted_qty===""?null:Number(l.counted_qty)}).eq("id",l.id);}note(true,"حُفظ العدّ");};
  const post=async()=>{
    for(const l of lines){if(l.counted_qty===null||l.counted_qty==="")continue;const delta=Number(l.counted_qty)-Number(l.system_qty||0);if(delta!==0&&l.item_id)await supabase.from("sc_moves").insert({operator_id:op,item_id:l.item_id,kind:"adjust",qty:delta,ref_type:"stocktake",ref_id:open,note:"تسوية جرد"});}
    await supabase.from("sc_stocktakes").update({status:"posted",posted_at:new Date().toISOString()}).eq("id",open);
    setOpen(null);note(true,"اعتُمد الجرد وسُوّي المخزون");await load();
  };

  if(open){const varc=l=>l.counted_qty===null||l.counted_qty===""?null:Number(l.counted_qty)-Number(l.system_qty||0);return(
    <div>
      <div className="sp-bar"><button className="sp-b ghost" onClick={()=>setOpen(null)}><Icon n="back" s={14}/> رجوع</button><div style={{flex:1}}/><button className="sp-b" onClick={saveCounts}><Icon n="save" s={14}/> حفظ العدّ</button><button className="sp-b brand" onClick={post}><Icon n="check" s={14}/> اعتماد وتسوية</button></div>
      <div className="sp-list">{lines.map(l=>{const v=varc(l);return(
        <div className="sp-take-row" key={l.id}>
          <div style={{flex:1,minWidth:0}}><div className="sp-name">{l.item_name}</div><div className="sp-sub">النظام: {Number(l.system_qty||0)}</div></div>
          <input className="sp-count" type="number" placeholder="العدّ" value={l.counted_qty??""} onChange={e=>setCount(l.id,e.target.value)}/>
          {v!=null&&<span className={"sp-var "+(v===0?"z":v>0?"p":"n")}>{v>0?"+":""}{v}</span>}
        </div>);})}</div>
    </div>);}

  return(<div>
    <div className="sp-bar"><div style={{flex:1,fontSize:12.5,color:"#64748b",fontWeight:700}}>الجرد الدوري: عدّ فعلي ← فروقات ← تسوية المخزون</div><button className="sp-add" onClick={start}><Icon n="plus" s={15}/> جرد جديد</button></div>
    {takes.length===0?<Empty ic="check" t="لا عمليات جرد بعد" s="ابدأ جرداً دورياً لمطابقة الأرصدة الفعلية مع النظام."/>:
    <div className="sp-list">{takes.map(t=>(
      <div className="sp-item" key={t.id} onClick={()=>t.status==="open"&&openTake(t.id)} style={{cursor:t.status==="open"?"pointer":"default"}}>
        <div className="sp-av"><Icon n="check" s={16}/></div>
        <div style={{flex:1}}><div className="sp-name">جرد {fmtD(t.taken_on)}</div><div className="sp-sub">{t.status==="open"?"مفتوح — بانتظار العدّ":"معتمد ومُسوّى"}</div></div>
        <span className="sp-badge" style={t.status==="open"?{background:"#fef3e2",color:"#b54708"}:{background:"#e7f7ef",color:"#087443"}}>{t.status==="open"?"مفتوح":"معتمد"}</span>
      </div>))}</div>}
  </div>);
}

/* ═══ عناصر مشتركة ═══ */
function K({ic,c,bg,t,v}){return(<div className="sp-kpi"><span className="sp-ki" style={{background:bg,color:c}}><Icon n={ic} s={17}/></span><div style={{minWidth:0}}><div className="sp-kv">{v}</div><div className="sp-kl">{t}</div></div></div>);}
function Empty({ic,t,s}){return(<div className="sp-empty"><div className="sp-empty-ic"><Icon n={ic} s={28}/></div><h3>{t}</h3><p>{s}</p></div>);}
function F({l,children}){return(<label className="sp-f"><span>{l}</span>{children}</label>);}
function Modal({title,onClose,children}){return(<div className="sp-modal" onClick={e=>{if(e.target.className==="sp-modal")onClose();}}><div className="sp-sheet"><div className="sp-sheet-h"><b>{title}</b><button onClick={onClose}><Icon n="x" s={16}/></button></div>{children}</div></div>);}

const CSS=`
.sp{--b:#E8712B}
.sp-tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.sp-tabs button{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #e6e9ee;border-radius:11px;padding:9px 15px;font-family:inherit;font-size:13px;font-weight:700;color:#64748b;cursor:pointer}
.sp-tabs button.on{background:linear-gradient(135deg,#E8712B,#f5a35f);border-color:transparent;color:#fff}
.sp-msg{padding:9px 13px;border-radius:11px;font-size:12.5px;font-weight:700;margin-bottom:12px}
.sp-msg.ok{background:#e7f7ef;color:#087443}.sp-msg.err{background:#feecea;color:#b42318}
.sp-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
.sp-kpi{background:#fff;border:1px solid #eceef1;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sp-ki{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.sp-kv{font-size:18px;font-weight:800;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sp-kl{font-size:11px;color:#64748b;font-weight:600}
.sp-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.sp-filters{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.sp-filters button{background:#fff;border:1px solid #e6e9ee;border-radius:20px;padding:5px 12px;font-family:inherit;font-size:11.5px;font-weight:700;color:#64748b;cursor:pointer}
.sp-filters button.on{background:#0e1622;border-color:#0e1622;color:#fff}
.sp-add{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#E8712B,#f5a35f);border:none;border-radius:11px;padding:9px 15px;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;flex:none}
.sp-list{display:flex;flex-direction:column;gap:9px}
.sp-item{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #eceef1;border-radius:14px;padding:11px 14px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sp-av{width:40px;height:40px;border-radius:12px;background:#fff2e8;color:#E8712B;display:flex;align-items:center;justify-content:center;flex:none}
.sp-name{font-size:13.5px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sp-sub{font-size:11px;color:#94a3b8;margin-top:2px}
.sp-tag{font-size:9.5px;font-weight:800;background:#fff2e8;color:#b54708;padding:1px 7px;border-radius:20px}
.sp-tag.off{background:#feecea;color:#b42318}
.sp-qtybox{text-align:center;flex:none}
.sp-qty{font-size:17px;font-weight:800;color:#0f172a}.sp-qty.low{color:#b42318}
.sp-qtybox small{display:block;font-size:9.5px;color:#94a3b8}
.sp-iact{display:flex;gap:6px;flex:none}
.sp-iact button{border:1px solid #e6e9ee;background:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center}
.sp-empty{background:#fff;border:1px dashed #e6e9ee;border-radius:16px;padding:38px 24px;text-align:center}
.sp-empty-ic{width:60px;height:60px;border-radius:16px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fff2e8,#ffe2cc);color:var(--b)}
.sp-empty h3{font-size:15px;margin:0 0 7px}.sp-empty p{color:#64748b;font-size:12px;max-width:400px;margin:0 auto;line-height:1.7}
/* requests */
.sp-req{background:#fff;border:1px solid #eceef1;border-radius:14px;box-shadow:0 1px 2px rgba(16,24,40,.05);overflow:hidden}
.sp-req-top{display:flex;align-items:center;gap:11px;padding:12px 14px;cursor:pointer}
.sp-seq{font-size:12px;font-weight:800;color:#94a3b8;background:#f4f5f7;padding:3px 9px;border-radius:8px;flex:none}
.sp-type{font-size:10px;font-weight:800;background:#eef4ff;color:#1d5bbf;padding:1px 8px;border-radius:20px}
.sp-badge{font-size:11px;font-weight:800;padding:3px 11px;border-radius:20px;flex:none}
.sp-req-b{padding:0 14px 13px;border-top:1px solid #f4f5f7}
.sp-reqitems{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.sp-ri{display:flex;justify-content:space-between;font-size:12px;color:#475569;background:#fafbfc;border:1px solid #f1f3f5;border-radius:9px;padding:7px 11px}
.sp-reqact{display:flex;gap:8px;margin-top:10px}
.sp-wait{font-size:11.5px;color:#b54708;font-weight:700}
/* custody */
.sp-cust{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}
.sp-cust-card{background:#fff;border:1px solid #eceef1;border-radius:14px;padding:13px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sp-cust-h{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.sp-cust-av{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#E8712B,#f5a35f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex:none}
.sp-cust-h b{font-size:13.5px;font-weight:800;flex:1}
.sp-cust-cnt{font-size:10.5px;font-weight:800;color:#64748b;background:#f4f5f7;padding:2px 9px;border-radius:20px}
.sp-cust-items{display:flex;flex-direction:column;gap:6px}
.sp-cust-it{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fafbfc;border:1px solid #f1f3f5;border-radius:9px;padding:7px 10px}
.sp-cust-nm{font-size:12px;font-weight:700;color:#334155}
.sp-out{font-style:normal;font-size:9px;background:#fef3e2;color:#b54708;padding:1px 6px;border-radius:20px;margin-inline-start:5px}
.sp-cust-a{display:flex;gap:5px;flex:none}
.sp-cust-a button{border:none;background:#eef4ff;color:#1d5bbf;width:26px;height:26px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.sp-cust-a button.lost{background:#feecea;color:#b42318}
/* stocktake */
.sp-take-row{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid #eceef1;border-radius:12px;padding:11px 13px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.sp-count{width:80px;border:1px solid #e6e9ee;border-radius:9px;padding:8px;font-family:inherit;font-size:13px;text-align:center;outline:none}
.sp-var{font-size:13px;font-weight:800;min-width:44px;text-align:center;border-radius:8px;padding:4px 6px}
.sp-var.z{background:#f4f5f7;color:#94a3b8}.sp-var.p{background:#e7f7ef;color:#087443}.sp-var.n{background:#feecea;color:#b42318}
/* modal + forms */
.sp-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:100}
.sp-sheet{background:#fff;border-radius:20px 20px 0 0;padding:18px;width:100%;max-width:560px;max-height:92vh;overflow:auto}
@media(min-width:560px){.sp-modal{align-items:center}.sp-sheet{border-radius:18px}}
.sp-sheet-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.sp-sheet-h b{font-size:15px;font-weight:800}
.sp-sheet-h button{border:none;background:#f4f5f7;width:30px;height:30px;border-radius:9px;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center}
.sp-f{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}
.sp-f span{font-size:11px;color:#64748b;font-weight:600}
.sp-f input,.sp-f select,.sp-f textarea{border:1px solid #e6e9ee;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13px;outline:none;background:#fff;color:#0f172a}
.sp-f input:focus,.sp-f select:focus{border-color:var(--b);box-shadow:0 0 0 3px rgba(232,113,43,.1)}
.sp-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-chk{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:9px;cursor:pointer}
.sp-chk input{width:17px;height:17px;accent-color:#087443}
.sp-mact{display:flex;gap:8px;margin-top:6px}
.sp-b{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;border:none;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;background:#0f172a;color:#fff}
.sp-b.brand{background:linear-gradient(135deg,#E8712B,#f5a35f)}
.sp-b.ok{background:linear-gradient(135deg,#12b76a,#087443)}
.sp-b.ghost{background:#fff;border:1px solid #e6e9ee;color:#334155}
.sp-b.danger{background:#feecea;color:#b42318}
.sp-hint{font-size:12px;color:#64748b;line-height:1.6;margin:0 0 8px}
.sp-lines-h{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;font-weight:800;color:#64748b;margin:6px 0 8px}
.sp-lines-h button{border:none;background:#fff2e8;color:#b54708;border-radius:8px;padding:4px 9px;font-family:inherit;font-size:11px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.sp-line{display:grid;grid-template-columns:1.3fr 1.3fr .7fr .8fr auto;gap:6px;margin-bottom:7px}
.sp-line select,.sp-line input{border:1px solid #e6e9ee;border-radius:9px;padding:8px;font-family:inherit;font-size:12px;outline:none;min-width:0}
.sp-linex{border:none;background:#feecea;color:#b42318;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.sp-route{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;border-radius:10px;padding:9px 11px;margin:8px 0}
.sp-route.auto{background:#e7f7ef;color:#087443}
.sp-route.ceo{background:#fef3e2;color:#b54708}
.sp-modechips{display:flex;gap:8px;margin-bottom:10px}
.sp-modechips button{flex:1;border:1.5px solid #e6e9ee;background:#fff;border-radius:10px;padding:9px;font-family:inherit;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}
.sp-modechips button.on{border-color:#E8712B;background:#fff7f0;color:#b54708}
.sp-kit{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.sp-kitc{font-size:11px;font-weight:700;background:#f4f5f7;color:#475569;border-radius:20px;padding:4px 10px}
@media(max-width:720px){.sp-kpis{grid-template-columns:1fr}.sp-cust{grid-template-columns:1fr}.sp-g2{grid-template-columns:1fr}.sp-line{grid-template-columns:1fr 1fr;gap:6px}}
`;
