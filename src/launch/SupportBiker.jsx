// بوابة البايكر ← «الدعم والأفكار»: رفع مشكلة أو فكرة أو سؤال أو طلب (حتى 3 لقطات)، ومتابعة حالة طلباتي.
// يُحمَّل كسولاً داخل BikerPortal فتعمل عليه أنماط bp-*.
import { useEffect, useState } from "react";
import { KINDS, STATUS, MAX_PHOTOS, kindOf, validateTicket } from "./lib";
import { loadMyTickets, submitTicket, shotUrl } from "./store";
import { Btn, Bn, FieldErr, Skel, loadDraft, saveDraft } from "../uiKit";

const DRAFT = uid => "dw.support.draft." + uid;
const CSS = `
.sp-kinds{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sp-kinds button{min-height:52px}
.sp-hint{font-size:11.5px;color:var(--mut);margin-top:6px;line-height:1.6}
.sp-t{white-space:pre-wrap;word-break:break-word;color:var(--ink-2);font-size:12.5px;margin-top:6px;line-height:1.7}
.sp-reply{margin-top:8px;padding:9px 11px;border-radius:10px;background:var(--soft);border:1px solid var(--line);font-size:12.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
.sp-shots{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.sp-shots img,.sp-shots span{width:58px;height:58px;object-fit:cover;border-radius:9px;border:1px solid var(--line-2);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:var(--mut)}
.sp-x{position:relative}.sp-x button{position:absolute;top:-6px;inset-inline-end:-6px;width:24px;height:24px;border-radius:50%;border:none;background:var(--bad-ink);color:#fff;font-weight:900;cursor:pointer;line-height:1}
`;

function Shot({ path }) {
  const [u, setU] = useState(null);
  useEffect(() => { let on = true; shotUrl(path).then(x => on && setU(x || ""), () => on && setU("")); return () => { on = false; }; }, [path]);
  return u ? <a href={u} target="_blank" rel="noreferrer"><img src={u} alt="لقطة" /></a> : <span>{u === "" ? "—" : "…"}</span>;
}

export default function SupportBiker({ me, from }) {
  const [list, setList] = useState(null), [ready, setReady] = useState(true), [loadErr, setLoadErr] = useState(null);
  const d0 = loadDraft(DRAFT(me.uid)) || {};
  const [kind, setKind] = useState(d0.kind || ""), [body, setBody] = useState(d0.body || ""), [files, setFiles] = useState([]);
  const [fe, setFe] = useState({}), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const load = () => loadMyTickets(me.uid).then(r => { setList(r.tickets); setReady(r.ready); setLoadErr(r.error); }, e => { setList([]); setLoadErr(e); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { saveDraft(DRAFT(me.uid), kind || body ? { kind, body } : null); }, [kind, body, me.uid]);

  const send = async () => {
    setMsg(null);
    const errs = validateTicket({ kind, body, photos: files });
    setFe(Object.fromEntries(errs.map(e => [e.f, e])));
    if (errs.length) return;
    setBusy(true);
    const r = await submitTicket({ uid: me.uid, kind, body, screen: from || null, files });
    setBusy(false);
    if (r.error) { setMsg({ ok: false, ar: "تعذّر الإرسال: " + (r.error.message || r.error), bn: "পাঠানো যায়নি। আবার চেষ্টা করুন।" }); return; }
    setKind(""); setBody(""); setFiles([]); saveDraft(DRAFT(me.uid), null);
    setMsg({ ok: true, ar: `وصل طلبك #${r.ticket.seq}. يرد السفير خلال 24 ساعة.`, bn: `আপনার অনুরোধ #${r.ticket.seq} পৌঁছেছে। ২৪ ঘণ্টার মধ্যে উত্তর দেওয়া হবে।` });
    setList(l => [r.ticket, ...(l || [])]);
  };
  const k = kindOf(kind);

  return <>
    <style>{CSS}</style>
    <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl" style={{ marginTop: 0 }}>الدعم والأفكار <span className="bn">/ সহায়তা ও আইডিয়া</span></label>
      <div className="bp-note" style={{ marginTop: 0 }}>أنت شريك في تحسين المنصة. كل طلب يأخذ رداً وسبباً. <span className="bn">আপনি এই প্ল্যাটফর্মের অংশীদার। প্রতিটি অনুরোধের উত্তর দেওয়া হবে।</span></div>
      {!ready && <div className="bp-msg" role="status" style={{ background: "var(--warn-bg)", color: "var(--warn-ink)" }}>مركز الدعم لم يُفعَّل بعد — أرسل لسلمان في واتساب: النوع، الوصف، لقطة الشاشة.<Bn>এখনো চালু হয়নি — সালমানকে হোয়াটসঅ্যাপে পাঠান।</Bn></div>}

      <label className="bp-lbl">النوع <span className="bn">/ ধরন</span></label>
      <div className="bp-seg sp-kinds" role="radiogroup" aria-label="النوع">
        {KINDS.map(x => <button key={x.k} type="button" role="radio" aria-checked={kind === x.k} className={kind === x.k ? "on" : ""} onClick={() => setKind(x.k)}>{x.ar}<span className="bn">{x.bn}</span></button>)}
      </div>
      {kind && <div className="sp-hint">{k.hint} · <span lang="bn">{k.hintBn}</span></div>}
      <FieldErr t={fe.kind} />

      <label className="bp-lbl" htmlFor="sp_body">الوصف — بالعربي أو বাংলা أو English <span className="bn">/ বিবরণ</span></label>
      <textarea id="sp_body" className="g-textarea bp-ta" value={body} maxLength={2000} onChange={e => setBody(e.target.value)} placeholder="اكتب ما حدث أو فكرتك… · কী হয়েছে বা আপনার আইডিয়া লিখুন…" />
      <FieldErr t={fe.body} />

      <label className="bp-lbl">لقطات الشاشة (اختياري، حتى {MAX_PHOTOS}) <span className="bn">/ স্ক্রিনশট</span></label>
      {files.length < MAX_PHOTOS && <div className="bp-photo"><input id="sp_files" type="file" accept="image/*" multiple onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files || [])].slice(0, MAX_PHOTOS)); e.target.value = ""; }} />
        <label htmlFor="sp_files">📷 إضافة لقطة · <span lang="bn">স্ক্রিনশট যোগ করুন</span></label></div>}
      {files.length > 0 && <div className="sp-shots">{files.map((f, i) => <span className="sp-x" key={i}><img src={URL.createObjectURL(f)} alt={"لقطة " + (i + 1)} /><button type="button" aria-label="حذف اللقطة" onClick={() => setFiles(a => a.filter((_, j) => j !== i))}>×</button></span>)}</div>}
      <FieldErr t={fe.photos} />

      {msg && <div className={"bp-msg " + (msg.ok ? "bp-ok" : "")} role={msg.ok ? "status" : "alert"} style={msg.ok ? undefined : { background: "var(--bad-bg)", color: "var(--bad-ink)" }}>{msg.ar}<Bn>{msg.bn}</Bn></div>}
      <Btn kind="primary" block busy={busy} disabled={busy || !ready} style={{ marginTop: 14 }} onClick={send} bn="পাঠান">إرسال</Btn>
      <div className="bp-note">الخلافات مع الزملاء والراتب الشخصي تبقى مع المشرف سلمان مباشرة. <span className="bn">সহকর্মীর সাথে বিরোধ ও ব্যক্তিগত বেতন — সরাসরি সুপারভাইজার সালমানের সাথে।</span></div>
    </div></div>

    <div className="bp-card g-card" style={{ marginTop: 14 }}><div className="bp-sec">
      <label className="bp-lbl" style={{ marginTop: 0 }}>طلباتي <span className="bn">/ আমার অনুরোধ</span></label>
      {list === null ? <Skel rows={2} card={false} />
        : loadErr ? <div className="bp-note">تعذّر تحميل طلباتك. <span className="bn">লোড করা যায়নি।</span></div>
        : list.length === 0 ? <div className="g-empty" style={{ padding: "16px 10px" }}><b>لا طلبات بعد · <span className="bn">এখনো কোনো অনুরোধ নেই</span></b></div>
        : list.map(t => { const s = STATUS[t.status] || STATUS.new, kk = kindOf(t.kind); return (
          <div className="bp-item" key={t.id}>
            <div className="t">#{t.seq} · {kk.ar} <span className="bn" style={{ fontWeight: 600, color: "var(--mut)" }}>{kk.bn}</span>
              <span className={"g-badge " + s.tone}><i />{s.ar} · <span lang="bn">{s.bn}</span></span></div>
            <div className="m">{new Date(t.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}{t.supply_request_id ? " · حُوِّل لطلبات الإمداد" : ""}</div>
            <div className="sp-t">{t.body}</div>
            {(t.photos || []).length > 0 && <div className="sp-shots">{t.photos.map(p => <Shot key={p} path={p} />)}</div>}
            {t.reply && <div className="sp-reply"><b>الرد · <span lang="bn">উত্তর</span>:</b> {t.reply}</div>}
          </div>); })}
    </div></div>
  </>;
}
