// أكاديمية دلو ورغوة — واجهة البايكر داخل بوابة البايكر (تبويب «الأكاديمية»).
// المحتوى ومنطق الأسئلة والنجاح من engine.js كما هي؛ الهوية من تسجيل الدخول؛ النتائج في training_attempts / training_practicals.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { $, TOWELS, TOWEL_WHY, TOWEL_NOTES, SPRAYS, SPRAY_WHY, TOOLS, DAY, DAY_GROUPS, QUALITY } from "./content";
import { CFG, MODS, WASH, PATH, TF_T, allSteps, modName, curIdx, doneCount, stationState, idxOf, modsDone, certified, stage,
  shuffle, buildQuiz, pointsFor, quizResult, stateFrom, missFrom, topMiss, wrongsOf, dailyStreak, CLIPS, fmtTime } from "./engine";
import { loadMine, saveAttempt, savePractical, listVideos, videoUrl } from "./store";

export const ACADEMY_CSS = `
.ac{display:flex;flex-direction:column;gap:12px;max-width:560px;margin:0 auto;min-width:0;font-size:15px;line-height:1.6}
.ac *{box-sizing:border-box}
.ac-card{padding:16px;border-radius:18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.ac h2{font-size:17px;font-weight:900;margin:0;color:var(--ink)}
.ac h1{font-size:22px;font-weight:900;margin:0;color:var(--ink);line-height:1.4}
.ac-bi{display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}
.ac-bi .bn{font-size:.84em;color:var(--mut);font-weight:500;line-height:1.5}
.ac.bnf .ac-bi{flex-direction:column-reverse}
.ac.bnf .ac-bi .bn{font-size:1em;color:inherit;font-weight:inherit}
.ac.bnf .ac-bi .ar{font-size:.84em;color:var(--mut);font-weight:500}
.ac-bnl{font-weight:500;font-size:.86em;opacity:.92}
.ac-mut{color:var(--mut);font-size:13px}
.ac-eyebrow{font-size:12px;font-weight:800;color:var(--p-ink);letter-spacing:.2px}
.ac-row{display:flex;align-items:center;gap:10px;min-width:0}.ac-grow{flex:1;min-width:0}
.ac-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.ac-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ac .g-btn{min-height:50px;font-size:15px;border-radius:13px;flex-wrap:wrap;line-height:1.35}
.ac .g-btn.sm{min-height:44px;font-size:13px}
.ac-btns{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.ac-back{align-self:flex-start;min-height:44px!important}
.ac-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border-radius:14px;background:var(--soft);border:1px solid var(--line)}
.ac-seg button{min-height:46px;border:none;border-radius:10px;background:transparent;color:var(--mut);font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;line-height:1.3}
.ac-seg button .bn{display:block;font-size:11px;font-weight:600}
.ac-seg button.on{background:var(--glass-3);color:var(--p-ink);box-shadow:var(--shadow)}
.ac-seg button:focus-visible,.ac-opt:focus-visible,.ac-pt-b:focus-visible{outline:none;box-shadow:var(--glow)}
.ac-flow{display:flex;align-items:center;gap:6px;min-width:0}
.ac-flow span{display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:800;color:var(--mut);min-width:0}
.ac-flow b{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--soft);border:1px solid var(--line-2);font-size:12px;flex:none}
.ac-flow .now{color:var(--p-ink)}.ac-flow .now b{background:linear-gradient(135deg,var(--a),var(--p));color:#fff;border-color:transparent}
.ac-flow .done{color:var(--ok-ink)}.ac-flow .done b{background:var(--ok-bg);border-color:transparent}
.ac-flow i{flex:1;height:2px;background:var(--line-2);min-width:6px}
.ac-flow .bn{font-size:10.5px;font-weight:600}
@media(max-width:400px){.ac-flow .bn{display:none}}
.ac-dots{display:flex;gap:6px;justify-content:center}.ac-dots i{width:9px;height:9px;border-radius:50%;background:var(--line-2)}
.ac-dots i.done{background:var(--ok)}.ac-dots i.now{background:var(--p);width:22px;border-radius:6px}
.ac-path{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ac-pt{display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;align-items:start;position:relative}
.ac-pt::before{content:"";position:absolute;inset-inline-start:16px;top:36px;bottom:-10px;width:2px;background:var(--line-2)}
.ac-pt:last-child::before{display:none}
.ac-pt-n{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;background:var(--glass-2);border:1px solid var(--line-2);color:var(--mut);position:relative;z-index:1}
.ac-pt.done .ac-pt-n{background:var(--ok-bg);color:var(--ok-ink);border-color:transparent}
.ac-pt.now .ac-pt-n{background:linear-gradient(135deg,var(--a),var(--p));color:#fff;border-color:transparent}
.ac-pt-b{width:100%;min-height:52px;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:var(--glass-2);color:var(--ink);font:inherit;text-align:start;cursor:pointer}
.ac-pt-b:disabled{cursor:default;opacity:.6}
.ac-pt.now .ac-pt-b{flex-direction:column;align-items:stretch;border-color:rgba(var(--p-rgb),.45);background:var(--p-50);cursor:default}
.ac-pt-b b{font-weight:800}
.ac-ico{width:52px;height:52px;border-radius:12px;object-fit:cover;flex:none;background:var(--soft)}
.ac-item{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:start}
.ac-item .ac-ico{width:64px;height:64px;background:#fff}
.ac-sw{display:inline-block;width:18px;height:18px;border-radius:5px;border:1px solid var(--line-2);vertical-align:middle;margin-top:6px}
.ac-note{padding:11px 13px;border-radius:12px;background:var(--soft);border:1px solid var(--line);font-size:14px;color:var(--ink-2)}
.ac-note.ok{background:var(--ok-bg);color:var(--ok-ink);border-color:transparent}
.ac-note.bad{background:var(--bad-bg);color:var(--bad-ink);border-color:transparent}
.ac-note.warn{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
.ac-note .ac-bi .bn,.ac-note.ok .ac-bi .ar,.ac-note.bad .ac-bi .ar,.ac-note.warn .ac-bi .ar{color:inherit;opacity:.85}
.ac-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.ac-steps li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start}
.ac-steps .n{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--p-100);color:var(--p-ink);font-weight:900;font-size:13px}
.ac-okc{display:block;margin-top:4px;font-size:13px;color:var(--ok-ink);font-weight:700}
.ac-tag{display:inline-block;padding:1px 8px;border-radius:8px;background:var(--p-100);color:var(--p-ink);font-size:12px;font-weight:800;margin-inline-end:6px}
.ac-tag.app{background:var(--info-bg);color:var(--info-ink)}
.ac-qhead{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center}
.ac-q-t{font-size:18px;font-weight:900;color:var(--ink);line-height:1.5}
.ac-q-img{width:100%;max-height:210px;object-fit:contain;background:#fff;border-radius:14px;border:1px solid var(--line)}
.ac-opts{display:grid;gap:8px}.ac-opts.grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.ac-opt{width:100%;min-height:54px;padding:10px 12px;border-radius:14px;border:1.5px solid var(--line-2);background:var(--glass-2);color:var(--ink);font:inherit;font-size:15px;font-weight:700;text-align:start;display:flex;align-items:center;gap:10px;cursor:pointer;transition:background .15s,border-color .15s}
.ac-opt img{width:48px;height:48px;border-radius:10px;object-fit:cover;flex:none;background:#fff}
.ac-opts.grid .ac-opt{flex-direction:column;align-items:stretch;text-align:center}
.ac-opts.grid .ac-opt img{width:100%;height:auto;aspect-ratio:1/1;max-height:120px;object-fit:contain}
.ac-opt.sel{background:var(--p-100);border-color:var(--p)}
.ac-opt.right{background:var(--ok-bg);border-color:var(--ok);color:var(--ok-ink)}
.ac-opt.wrong{background:var(--bad-bg);border-color:var(--bad);color:var(--bad-ink)}
.ac-opt.gone{opacity:.5}
.ac-opt:disabled{cursor:default}
.ac-opt .ac-ord{width:26px;height:26px;border-radius:50%;background:var(--ok);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex:none}
.ac-tf{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ac-tf .ac-opt{justify-content:center;font-size:18px;font-weight:900;flex-direction:column;gap:0}
.ac-stmt{font-size:17px;font-weight:800;padding:14px;border-radius:14px;background:var(--soft);border:1px solid var(--line);color:var(--ink)}
.ac-match{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ac-match>div{display:flex;flex-direction:column;gap:8px}
.ac-match .ac-opt{font-size:13.5px;padding:8px 9px;gap:7px}.ac-match .ac-opt img{width:38px;height:38px}
.ac-shake{animation:acShake .3s}
@keyframes acShake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (prefers-reduced-motion:reduce){.ac-shake{animation:none}}
.ac-score{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px}
.ac-score .big{font-size:48px;font-weight:900;line-height:1.1}
.ac-score.pass .big{color:var(--ok-ink)}.ac-score.fail .big{color:var(--bad-ink)}
.ac-tbl{width:100%;border-collapse:collapse;font-size:14px}.ac-tbl td{padding:7px 4px;border-top:1px solid var(--line)}.ac-tbl td:last-child{text-align:end}
.ac-hist>div{padding:9px 0;border-top:1px solid var(--line)}.ac-hist>div:first-child{border-top:none}
.ac-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;text-align:center}
.ac-stats b{display:block;font-size:21px;font-weight:900;color:var(--ink)}.ac-stats span{font-size:11.5px;color:var(--mut);font-weight:700}
.ac-run-step{font-size:23px;font-weight:900;line-height:1.5;color:var(--ink)}
.ac-timer{font-size:22px;font-weight:900;color:var(--p-ink)}
.ac-big{min-height:66px!important;font-size:20px!important}
.ac-video{width:100%;aspect-ratio:16/9;border-radius:14px;background:#000;display:block}
.ac-hero{background:linear-gradient(135deg,var(--a),var(--p));color:#fff;border:none}
.ac-hero .ac-bi .bn,.ac-hero .ac-mut,.ac.bnf .ac-hero .ac-bi .ar{color:rgba(255,255,255,.88)}
.ac-hero .g-track{background:rgba(255,255,255,.28)}.ac-hero .g-track>i{background:#fff}
`;

const B = ({ t, className = "" }) => <span className={"ac-bi " + className}><span className="ar">{t.ar}</span><span className="bn" lang="bn">{t.bn}</span></span>;
const Bn = ({ children }) => <span className="bn ac-bnl" lang="bn">{children}</span>;
const LS = { get(k, d) { try { const v = localStorage.getItem("dwa_" + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem("dwa_" + k, JSON.stringify(v)); } catch { /* تخزين غير متاح */ } } };
const localDay = d => new Date(d).toLocaleDateString("en-CA");
const fmtDate = d => { try { return new Date(d).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "short" }); } catch { return ""; } };
const top = () => { try { window.scrollTo(0, 0); } catch { /* */ } };

function Flow({ n }) {
  const L = [["تعلّم", "শেখো"], ["العب", "খেলো"], ["النتيجة", "ফলাফল"]];
  return <div className="ac-flow" aria-label={`الخطوة ${n} من 3`}>{L.map(([a, b], i) => <React.Fragment key={i}>{i > 0 && <i />}
    <span className={i + 1 < n ? "done" : i + 1 === n ? "now" : ""}><b className="ac-num">{i + 1 < n ? "✓" : i + 1}</b>{a} <Bn>{b}</Bn></span></React.Fragment>)}</div>;
}

// مقطع مرحلة من الملف الأصلي: قفز للبداية عند التشغيل وإيقاف عند النهاية
export function Clip({ clip, videos, autoPlay }) {
  const c = CLIPS[clip], v = videos && videos.map && videos.map[c.file];
  const [url, setUrl] = useState(null), ref = useRef(null);
  useEffect(() => { setUrl(null); if (!v) return; let on = true; videoUrl(v.storage_path).then(u => { if (on) setUrl(u || ""); }); return () => { on = false; }; }, [v && v.storage_path]);
  if (!videos) return <div className="ac-note ac-mut">جارٍ تحميل المقطع… · <Bn>ভিডিও লোড হচ্ছে…</Bn></div>;
  if (!v) return <div className="ac-note warn"><B t={$("المقطع لم يُرفع بعد", "ভিডিও এখনও আপলোড হয়নি")} /></div>;
  if (url === "") return <div className="ac-note bad"><B t={$("تعذّر فتح المقطع الآن", "এখন ভিডিও খোলা যাচ্ছে না")} /></div>;
  if (!url) return <div className="ac-note ac-mut">جارٍ تحميل المقطع… · <Bn>ভিডিও লোড হচ্ছে…</Bn></div>;
  const toStart = el => { if (el.currentTime < c.from - 0.5 || el.currentTime >= c.to - 0.25) el.currentTime = c.from; };
  return <div>
    <video ref={ref} className="ac-video" controls playsInline preload="metadata" autoPlay={autoPlay} src={`${url}#t=${c.from},${c.to}`}
      onLoadedMetadata={e => { e.target.currentTime = c.from; }}
      onPlay={e => toStart(e.target)}
      onTimeUpdate={e => { const el = e.target; if (el.currentTime >= c.to) { el.pause(); el.currentTime = c.to; } }} />
    <div className="ac-mut" style={{ marginTop: 4 }}>المقطع <span className="ac-num">{fmtTime(c.from)}–{fmtTime(c.to)}</span></div>
  </div>;
}

export default function Academy({ me }) {
  const empId = me && me.emp_id;
  const [IMG, setIMG] = useState({});
  const [data, setData] = useState(null); // {attempts, practicals, ready, error}
  const [videos, setVideos] = useState(null);
  const [bnFirst, setBnFirst] = useState(() => !!LS.get("bnFirst", false));
  const [tab, setTab] = useState("home");
  const [view, setView] = useState(null);
  const [Q, setQ] = useState(null);
  const [R, setR] = useState(null);
  const [, setTick] = useState(0);
  const [saveMsg, setSaveMsg] = useState("");
  const wake = useRef(null);

  useEffect(() => { let on = true; import("./images").then(m => { if (on) setIMG(m.default || {}); }).catch(() => {}); return () => { on = false; }; }, []);
  useEffect(() => { if (!empId) return; let on = true;
    loadMine(empId).then(r => { if (on) setData(r); }).catch(e => { if (on) setData({ attempts: [], practicals: [], ready: false, error: e }); });
    listVideos().then(r => { if (on) setVideos(r); }).catch(() => { if (on) setVideos({ map: {} }); });
    return () => { on = false; }; }, [empId]);
  useEffect(() => { if (!R || R.done) return; const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, [R]);
  useEffect(() => () => { try { wake.current && wake.current.release(); } catch { /* */ } }, []);

  const attempts = data ? data.attempts : [], practicals = data ? data.practicals : [];
  const st = useMemo(() => stateFrom(attempts, practicals), [attempts, practicals]);
  const miss = useMemo(() => missFrom(attempts), [attempts]);
  const daily = useMemo(() => dailyStreak(attempts.filter(a => a.module === "daily").map(a => localDay(a.created_at)), localDay(Date.now())), [attempts]);

  if (!empId) return <div className="ac"><div className="ac-card g-card"><div className="ac-note bad">حسابك غير مرتبط بسجل موظف، فلا يمكن حفظ تدريبك. راجع الإدارة. · <Bn>আপনার অ্যাকাউন্ট কর্মী রেকর্ডের সাথে যুক্ত নয়</Bn></div></div></div>;
  if (!data) return <div className="ac"><div className="ac-card g-card"><div className="ac-row ac-mut"><div className="g-spin" />جارٍ التحميل… · <Bn>লোড হচ্ছে…</Bn></div></div></div>;

  const go = v => { setView(v); top(); };
  const close = () => { setView(null); setQ(null); top(); };
  const toggleLang = () => { const v = !bnFirst; setBnFirst(v); LS.set("bnFirst", v); };
  const addLocal = (key, row) => setData(d => ({ ...d, [key]: [row, ...d[key]] }));
  const swapLocal = (key, tmpId, row) => setData(d => ({ ...d, [key]: d[key].map(x => x.id === tmpId ? row : x) }));
  const noteSave = r => { if (r.missing) setSaveMsg("missing"); else if (r.error) setSaveMsg("error"); };

  const openStation = i => { const s = PATH[i]; if (!s) return close(); if (s.t === "mod") go({ k: "lesson", id: s.id, p: 0 }); else if (s.t === "final") go({ k: "finalintro" }); else go({ k: "pracintro", kind: s.id }); };

  /* ── الاختبار ── */
  const initSt = q => q.type === "match" ? { left: shuffle(q.left), right: shuffle(q.right), sel: null, done: [], err: 0, fin: false }
    : q.type === "order" ? { items: shuffle(q.items.map((t, i) => ({ t, i }))), next: 0, err: 0, fin: false } : { ans: null, fin: false };
  const startQuiz = modId => { const qs = buildQuiz(modId, miss); setQ({ modId, qs, i: 0, pts: 0, log: [], seq: [], st: initSt(qs[0]), fx: null }); go({ k: "quiz" }); };
  const finishQ = (q0, st1, good, pts) => {
    const q = q0.qs[q0.i];
    return { ...q0, pts: q0.pts + pts, st: { ...st1, fin: true, good },
      log: good ? q0.log : [...q0.log, { topic: q.topic, why: q.why }],
      seq: [...q0.seq, good ? { right: true, k: q.why.ar } : { topic: q.topic, why: q.why }] };
  };
  const answer = v => setQ(q0 => { const q = q0.qs[q0.i]; if (q0.st.fin) return q0; const good = q.type === "tf" ? v === q.a : v === q.ans; return finishQ(q0, { ...q0.st, ans: v }, good, good ? 1 : 0); });
  // اهتزاز الخيار الخاطئ ثم زوال اللون بعد لحظة
  const shakeFx = k => { const n = Date.now() + Math.random(); setTimeout(() => setQ(q => q && q.fx && q.fx.n === n ? { ...q, fx: null } : q), 600); return { k, n }; };
  const matchLeft = k => setQ(q0 => ({ ...q0, st: { ...q0.st, sel: k } }));
  const matchRight = k => setQ(q0 => { const s = q0.st; if (!s.sel || s.fin) return q0;
    if (s.sel === k) { const done = [...s.done, k], s1 = { ...s, done, sel: null }; return done.length === s.left.length ? finishQ(q0, s1, s.err === 0, pointsFor("match", s.err)) : { ...q0, st: s1 }; }
    return { ...q0, st: { ...s, err: s.err + 1, sel: null }, fx: shakeFx("mr" + k) }; });
  const orderTap = i => setQ(q0 => { const s = q0.st; if (s.fin) return q0;
    if (i === s.next) { const s1 = { ...s, next: s.next + 1 }; return s1.next === s.items.length ? finishQ(q0, s1, s.err === 0, pointsFor("order", s.err)) : { ...q0, st: s1 }; }
    return { ...q0, st: { ...s, err: s.err + 1 }, fx: shakeFx("ord" + i) }; });
  const nextQ = () => { if (Q.i + 1 < Q.qs.length) { setQ({ ...Q, i: Q.i + 1, st: initSt(Q.qs[Q.i + 1]), fx: null }); top(); } else endQuiz(); };
  const endQuiz = async () => {
    const r = quizResult(Q.modId, Q.qs, Q.pts, Q.log);
    const tmp = "tmp-" + Date.now(), row = { id: tmp, module: Q.modId, pct: r.pct, pass: r.pass, mistakes: Q.seq, created_at: new Date().toISOString() };
    addLocal("attempts", row); setQ(null); go({ k: "result", r });
    const s = await saveAttempt(empId, { module: Q.modId, pct: r.pct, pass: r.pass, mistakes: Q.seq });
    if (s.row) swapLocal("attempts", tmp, s.row); else noteSave(s);
  };

  /* ── التدريب الذاتي ── */
  const startRun = kind => { setR({ kind, i: 0, t0: Date.now(), clip: false }); go({ k: "run" });
    try { navigator.wakeLock && navigator.wakeLock.request("screen").then(w => { wake.current = w; }).catch(() => {}); } catch { /* الرفض مقبول */ } };
  const releaseWake = () => { try { wake.current && wake.current.release(); } catch { /* */ } wake.current = null; };
  const endRun = async () => {
    const secs = Math.floor((Date.now() - R.t0) / 1000), kind = R.kind; releaseWake(); setR({ ...R, done: true });
    go({ k: "rundone", kind, secs });
    const tmp = "tmp-" + Date.now(); addLocal("practicals", { id: tmp, kind, mode: "self", secs, created_at: new Date().toISOString() });
    const s = await savePractical({ employee_id: empId, kind, mode: "self", secs });
    if (s.row) swapLocal("practicals", tmp, s.row); else noteSave(s);
  };

  const cur = curIdx(st), total = PATH.length, done = doneCount(st);
  const nextBtn = (t, id, pass) => { const i = idxOf(t, id); if (!pass || i < 0) return null; const n = PATH[i + 1];
    return n ? <button className="g-btn primary block" onClick={() => openStation(i + 1)}>التالي: {n.name.ar} <Bn>পরের ধাপ: {n.name.bn}</Bn></button>
      : <button className="g-btn primary block" onClick={close}>أكملت الطريق ✓ <Bn>পথ শেষ</Bn></button>; };
  const back = <button className="g-btn sm ac-back" onClick={close}>→ طريقي <Bn>আমার পথ</Bn></button>;

  const banner = (!data.ready || saveMsg) && <div className="ac-note warn">{saveMsg === "error" ? <B t={$("تعذّر حفظ آخر نتيجة. تحقّق من الاتصال.", "শেষ ফলাফল সংরক্ষণ হয়নি। সংযোগ দেখুন।")} />
    : <B t={$("الأكاديمية تعمل، لكن حفظ النتائج لم يُفعَّل بعد: تبقى نتائجك في هذه الجلسة فقط.", "একাডেমি চলছে, কিন্তু ফলাফল সংরক্ষণ এখনও চালু হয়নি: শুধু এই সেশনে থাকবে।")} />}</div>;

  let body;
  const v = view;
  if (!v) body = <>
    <div className="ac-seg" role="tablist">{[["home", "طريقي", "আমার পথ"], ["prac", "العملي", "হাতে-কলমে"], ["res", "نتائجي", "আমার ফলাফল"]].map(([k, a, b]) =>
      <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{a}<span className="bn" lang="bn">{b}</span></button>)}</div>
    {tab === "home" ? Home() : tab === "prac" ? Prac() : Results()}
  </>;
  else if (v.k === "lesson") body = Lesson({ v });
  else if (v.k === "finalintro") body = <>{back}<section className="ac-card g-card" style={{ alignItems: "center", textAlign: "center" }}>
    {IMG.extrabox && <img src={IMG.extrabox} alt="" style={{ width: 96, height: 96, borderRadius: 16, objectFit: "cover" }} />}<h1><B t={$("الاختبار الشامل", "পূর্ণ পরীক্ষা")} /></h1>
    <p style={{ margin: 0 }}><B t={$(`أسئلة من كل الوحدات. النجاح من ${CFG.passMark}% مع إتقان أسئلة المناشف كاملة.`, `সব ইউনিট থেকে প্রশ্ন। পাস ${CFG.passMark}% থেকে, তোয়ালের প্রশ্ন সব ঠিক হতে হবে।`)} /></p></section>
    <button className="g-btn primary block" onClick={() => startQuiz("final")}>▶ ابدأ الاختبار <Bn>শুরু করো</Bn></button></>;
  else if (v.k === "pracintro") body = PracIntro({ kind: v.kind });
  else if (v.k === "quiz" && Q) body = Quiz();
  else if (v.k === "result") body = Result({ r: v.r });
  else if (v.k === "run" && R) body = Run();
  else if (v.k === "rundone") body = <><section className="ac-card g-card" style={{ alignItems: "center", textAlign: "center" }}>
    <span className="ac-eyebrow">تدريب ذاتي · {modName(v.kind).ar}</span>
    <div className="ac-score pass"><span className="big ac-num">{fmtTime(v.secs)}</span><b>أكملت كل الخطوات</b><Bn>সব ধাপ শেষ</Bn></div>
    <div className="ac-note" style={{ alignSelf: "stretch" }}><B t={WASH[v.kind].final} /></div></section>
    <div className="ac-note warn"><B t={$("التدريب الذاتي لا يعتمدك. عندما تكون جاهزاً اطلب تقييم المشرف.", "নিজে অনুশীলনে অনুমোদন হয় না। প্রস্তুত হলে সুপারভাইজারের মূল্যায়ন চাও।")} /></div>
    <button className="g-btn block" onClick={close}>رجوع <Bn>ফিরে যাও</Bn></button></>;
  else body = null;

  return <div className={"ac" + (bnFirst ? " bnf" : "")}>
    <style>{ACADEMY_CSS}</style>
    <div className="ac-top"><b style={{ fontSize: 15 }}>أكاديمية دلو ورغوة · <Bn>বাইকার ট্রেনিং</Bn></b>
      <button className={"g-chip" + (bnFirst ? " on" : "")} style={{ minHeight: 40 }} aria-pressed={bnFirst} onClick={toggleLang}>বাংলা আগে</button></div>
    {banner}
    {body}
  </div>;

  /* ===== الشاشات (دوال داخلية تقرأ الحالة أعلاه) ===== */
  function Home() {
    const hi = (() => { const h = new Date().getHours(); return h >= 5 && h < 12 ? $("صباح الخير", "শুভ সকাল") : h < 17 ? $("مساء النور", "শুভ অপরাহ্ন") : $("مساء الخير", "শুভ সন্ধ্যা"); })();
    return <>
      <section className="ac-card g-card ac-hero">
        <B t={$(`${hi.ar}، ${me.name || ""}`, `${hi.bn}, ${me.name || ""}`)} />
        <div><div className="ac-row" style={{ justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}><b>طريقك إلى الاعتماد <Bn>অনুমোদনের পথ</Bn></b><b className="ac-num">{done}/{total}</b></div>
          <div className="g-track"><i style={{ width: Math.round(done / total * 100) + "%" }} /></div></div>
        {cur >= total ? <div className="ac-note ok"><B t={$("أنت بايكر معتمد. حافظ على مستواك بأسئلة اليوم.", "তুমি অনুমোদিত বাইকার। আজকের প্রশ্ন দিয়ে মান ধরে রাখো।")} /></div>
          : <div className="ac-mut">محطة واحدة في كل مرة: تعلّم، ثم العب، ثم انتقل للتي بعدها.</div>}
      </section>
      <ol className="ac-path">
        {PATH.map((s, i) => { const ss = stationState(i, st), score = s.t === "mod" && st.best[s.id] != null ? st.best[s.id] : null;
          const head = <span className="ac-pt-n ac-num" aria-hidden="true">{ss === "done" ? "✓" : ss === "lock" ? "🔒" : i + 1}</span>;
          if (ss === "now") return <li key={i} className="ac-pt now">{head}<div className="ac-pt-b">
            <span className="ac-eyebrow">محطتك الآن · <Bn>এখন তোমার ধাপ</Bn></span>
            <div className="ac-row">{IMG[s.icon] ? <img className="ac-ico" src={IMG[s.icon]} alt="" /> : <span className="ac-ico" />}<div className="ac-grow"><b><B t={s.name} /></b>
              <span className="ac-mut">{s.sub.ar}{score != null ? <> · آخر نتيجة <span className="ac-num">{score}%</span></> : null}</span></div></div>
            <button className="g-btn primary block" onClick={() => openStation(i)}>▶ {score != null ? "أكمل" : "ابدأ"} <Bn>{score != null ? "চালিয়ে যাও" : "শুরু করো"}</Bn></button></div></li>;
          return <li key={i} className={"ac-pt " + ss}>{head}<button className="ac-pt-b" disabled={ss === "lock"} onClick={() => openStation(i)} aria-label={ss === "lock" ? s.name.ar + " — مقفلة" : s.name.ar}>
            <span className="ac-grow"><b>{s.name.ar}</b><span className="bn ac-mut" lang="bn" style={{ display: "block" }}>{s.name.bn}</span></span>
            {ss === "done" && <span className="g-badge ok ac-num">{score != null ? score + "%" : "تم"}</span>}</button></li>; })}
        <li className={"ac-pt " + (cur >= total ? "done" : "lock")}><span className="ac-pt-n" aria-hidden="true">★</span><div className="ac-pt-b" style={{ cursor: "default" }}><b><B t={$("بايكر معتمد", "অনুমোদিত বাইকার")} /></b></div></li>
      </ol>
      {cur > 0 && <section className="ac-card g-card"><div className="ac-row"><div className="ac-grow"><span className="ac-eyebrow">مراجعة يومية · دقيقتان</span><h2><B t={$("أسئلة اليوم الخمسة", "আজকের ৫টি প্রশ্ন")} /></h2>
        <span className="ac-mut">{daily.doneToday ? "أنجزتها اليوم" : "من أخطائك السابقة"} · سلسلة <span className="ac-num">{daily.streak}</span> يوم</span></div>{daily.doneToday && <span className="g-badge ok">✓</span>}</div>
        <button className="g-btn block" onClick={() => startQuiz("daily")}>{daily.doneToday ? "أعدها للتدريب" : "ابدأ"} <Bn>{daily.doneToday ? "আবার" : "শুরু"}</Bn></button></section>}
    </>;
  }

  function Lesson({ v }) {
    const id = v.id, m = MODS.find(x => x.id === id), W = WASH[id];
    const item = (img, name, use, extra, k) => <div className="ac-card g-card" key={k}><div className="ac-item">{IMG[img] ? <img className="ac-ico" src={IMG[img]} alt="" /> : <span className="ac-ico" />}
      <div style={{ minWidth: 0 }}><b><B t={name} /></b><div style={{ marginTop: 4, fontSize: 14.5 }}><B t={use} /></div>{extra}</div></div></div>;
    const play = <button className="g-btn primary block" onClick={() => startQuiz(id)}>فهمت، ابدأ اللعبة <Bn>বুঝেছি, খেলা শুরু করো</Bn></button>;
    let content, foot = play;
    if (id === "towels") content = <>{TOWELS.map(r => item(r.img, r.name, r.use, <span className="ac-sw" style={{ background: r.color }} />, r.id))}<div className="ac-note"><B t={TOWEL_WHY} /></div>{TOWEL_NOTES.map((n, i) => <div key={i} className="ac-note warn"><B t={n} /></div>)}</>;
    else if (id === "products") content = <>{SPRAYS.map(r => { const t = r.towel && TOWELS.find(x => x.id === r.towel); return item(r.img, r.name, r.use, t ? <div className="ac-mut" style={{ marginTop: 4 }}>مع: {t.name.ar} <span className="ac-sw" style={{ background: t.color, marginTop: 0 }} /></div> : null, r.id); })}<div className="ac-note"><B t={SPRAY_WHY} /></div></>;
    else if (id === "tools") content = TOOLS.map(r => item(r.id, r.name, r.use, null, r.id));
    else if (W) { // شاشة لكل مرحلة، ثم شاشة القواعد
      const n = W.phases.length, p = Math.min(v.p || 0, n), last = p === n;
      const dots = <div className="ac-dots" aria-label={`الشاشة ${p + 1} من ${n + 1}`}>{[...Array(n + 1).keys()].map(i => <i key={i} className={i < p ? "done" : i === p ? "now" : ""} />)}</div>;
      if (!last) { const ph = W.phases[p], first = W.phases.slice(0, p).reduce((a, x) => a + x.steps.length, 0);
        content = <>{dots}<section className="ac-card g-card"><div className="ac-row"><div className="ac-grow"><span className="ac-eyebrow">المرحلة <span className="ac-num">{p + 1}</span> من <span className="ac-num">{n}</span></span><h2><B t={ph.name} /></h2></div><span className="g-badge">⏱ <span className="ac-num">{ph.dur}</span></span></div>
          <div className="ac-mut">شاهد المقطع أولاً، ثم راجع الخطوات تحته.</div>
          <Clip key={ph.clip} clip={ph.clip} videos={videos} />
          <ol className="ac-steps">{ph.steps.map((s, i) => <li key={i}><span className="n ac-num">{first + i + 1}</span><span style={{ minWidth: 0 }}><B t={s.t} /><span className="ac-okc">✓ {s.ok.ar} · <Bn>{s.ok.bn}</Bn></span></span></li>)}</ol></section></>;
      } else content = <>{dots}<section className="ac-card g-card"><span className="ac-eyebrow">قبل اللعبة · <Bn>খেলার আগে</Bn></span><h2><B t={$("القواعد الأربع في كل سيارة", "৪টি নিয়ম — সব গাড়িতে")} /></h2>
        {W.rules.map((r, i) => <div key={i} className="ac-note"><b className="ac-num">{i + 1}.</b> <B t={r.r} /></div>)}<div className="ac-note ok"><B t={W.final} /></div></section></>;
      const step = d => { setView({ ...v, p: Math.max(0, p + d) }); top(); };
      foot = <div className="ac-btns">{p > 0 && <button className="g-btn block" onClick={() => step(-1)}>السابقة <Bn>আগের</Bn></button>}
        {last ? play : <button className="g-btn primary block" onClick={() => step(1)}>{p + 1 === n ? "القواعد" : "المرحلة التالية"} <Bn>পরের</Bn></button>}</div>;
    } else if (id === "day") { const groups = []; DAY.forEach((d, i) => { if (!groups.length || groups[groups.length - 1].g !== d.group) groups.push({ g: d.group, items: [] }); groups[groups.length - 1].items.push({ ...d, n: i + 1 }); });
      content = <>{groups.map(g => <section key={g.g} className="ac-card g-card"><h2><B t={DAY_GROUPS[g.g]} /></h2><ol className="ac-steps">{g.items.map(d => <li key={d.n}><span className="n ac-num">{d.n}</span><span style={{ minWidth: 0 }}>{d.time && <span className="ac-tag ac-num">{d.time}</span>}{d.app && <span className="ac-tag app">التطبيق</span>}<B t={d.t} /></span></li>)}</ol></section>)}
        <div className="ac-note ok"><B t={$("السلامة أولاً · اجتهادك = دخلك · انضباطك = نجاحك · جودتك = رضا العميل", "নিরাপত্তা সবার আগে · কঠোর পরিশ্রম = আয় · শৃঙ্খলা = সাফল্য · গুণমান = গ্রাহকের সন্তুষ্টি")} /></div></>;
    } else content = QUALITY.map((e, i) => <div key={i} className={"ac-note " + (e.a ? "ok" : "bad")}><b>{e.a ? "✓ صح" : "✗ خطأ"}:</b> <B t={e.s} /><div style={{ marginTop: 6, fontWeight: 500 }}><B t={e.why} /></div></div>);
    return <>{back}<Flow n={1} /><h1><B t={m.name} /></h1>{content}{foot}</>;
  }

  function Quiz() {
    const q = Q.qs[Q.i], s = Q.st, pct = Math.round(Q.i / Q.qs.length * 100), fx = k => Q.fx && Q.fx.k === k ? " wrong ac-shake" : "";
    const img = k => IMG[k] ? <img src={IMG[k]} alt="" /> : null;
    let qb;
    if (q.type === "mcq") qb = <>{q.img && IMG[q.img] && <img className="ac-q-img" src={IMG[q.img]} alt="" />}<div className="ac-q-t"><B t={q.title} /></div>
      <div className={"ac-opts" + (q.grid ? " grid" : "")}>{q.opts.map(o => <button key={o.k} className={"ac-opt" + (s.fin ? (o.k === q.ans ? " right" : o.k === s.ans ? " wrong" : " gone") : "")} disabled={s.fin} onClick={() => answer(o.k)}>{o.img && img(o.img)}<B t={o.label} /></button>)}</div></>;
    else if (q.type === "tf") qb = <><div className="ac-q-t"><B t={TF_T} /></div><div className="ac-stmt"><B t={q.s} /></div>
      <div className="ac-tf">{[[true, "صح", "সঠিক"], [false, "خطأ", "ভুল"]].map(([val, a, b]) => <button key={a} className={"ac-opt" + (s.fin ? (val === q.a ? " right" : val === s.ans ? " wrong" : " gone") : "")} disabled={s.fin} onClick={() => answer(val)}>{a} <Bn>{b}</Bn></button>)}</div></>;
    else if (q.type === "match") qb = <><div className="ac-q-t"><B t={q.title} /></div><div className="ac-mut">اضغط عنصراً من اليمين ثم ما يناسبه من اليسار · <Bn>ডান থেকে একটি, তারপর বাম থেকে মিল</Bn></div>
      <div className="ac-match"><div>{s.left.map(o => <button key={o.k} className={"ac-opt" + (s.done.includes(o.k) ? " right" : s.sel === o.k ? " sel" : "")} disabled={s.done.includes(o.k)} aria-pressed={s.sel === o.k} onClick={() => matchLeft(o.k)}>{o.img && img(o.img)}<B t={o.label} /></button>)}</div>
        <div>{s.right.map(o => <button key={o.k + (Q.fx && Q.fx.k === "mr" + o.k ? Q.fx.n : "")} className={"ac-opt" + (s.done.includes(o.k) ? " right" : fx("mr" + o.k))} disabled={s.done.includes(o.k)} onClick={() => matchRight(o.k)}><B t={o.label} /></button>)}</div></div></>;
    else qb = <><div className="ac-q-t"><B t={q.title} /></div><div className="ac-mut">اضغط الخطوات بالترتيب · <Bn>ক্রম অনুযায়ী চাপো</Bn></div>
      <div className="ac-opts">{s.items.map(o => <button key={o.i + "-" + (Q.fx && Q.fx.k === "ord" + o.i ? Q.fx.n : "")} className={"ac-opt" + (o.i < s.next ? " right" : fx("ord" + o.i))} disabled={o.i < s.next} onClick={() => orderTap(o.i)}>{o.i < s.next && <span className="ac-ord ac-num">{o.i + 1}</span>}<B t={o.t} /></button>)}</div></>;
    const last = Q.i + 1 >= Q.qs.length;
    return <>{Q.modId !== "daily" && Q.modId !== "final" && <Flow n={2} />}
      <div className="ac-qhead"><button className="g-btn sm" style={{ minHeight: 40 }} onClick={close}>✕ خروج</button><div className="g-track"><i style={{ width: pct + "%" }} /></div><span className="ac-mut ac-num">{Q.i + 1}/{Q.qs.length}</span></div>
      <section className="ac-card g-card"><span className="ac-eyebrow">{modName(q.topic).ar} · <Bn>{modName(q.topic).bn}</Bn></span>{qb}
        {s.fin && <div className={"ac-note " + (s.good ? "ok" : "bad")} role="status"><b>{s.good ? "صحيح ✓" : "تحتاج تصحيح"}</b><div style={{ marginTop: 4 }}><B t={q.why} /></div></div>}</section>
      {s.fin && <button className="g-btn primary block" onClick={nextQ} autoFocus>{last ? "النتيجة" : "التالي"} <Bn>{last ? "ফলাফল" : "পরবর্তী"}</Bn></button>}</>;
  }

  function Result({ r }) {
    const t = r.modId === "final" ? "final" : "mod", station = idxOf(t, r.modId) >= 0, nb = nextBtn(t, r.modId, r.pass), topics = Object.keys(r.by);
    const retry = r.modId === "daily" ? <button className={"g-btn block" + (nb ? "" : " primary")} onClick={() => startQuiz("daily")}>العب مرة ثانية <Bn>আবার খেলো</Bn></button>
      : r.modId === "final" ? <button className={"g-btn block" + (nb ? "" : " primary")} onClick={() => startQuiz("final")}>أعد الاختبار <Bn>আবার</Bn></button>
      : <button className={"g-btn block" + (nb ? "" : " primary")} onClick={() => startQuiz(r.modId)}>{r.pass ? "العب مرة ثانية" : "أعد المحاولة"} <Bn>আবার</Bn></button>;
    return <>{station && t === "mod" && <Flow n={3} />}
      <section className="ac-card g-card"><div className={"ac-score " + (r.pass ? "pass" : "fail")}><span className="ac-eyebrow">{modName(r.modId).ar}</span><span className="big ac-num">{r.pct}%</span>
        <b>{r.pass ? "ناجح" : "يحتاج إعادة"} <Bn>{r.pass ? "পাস" : "আবার চেষ্টা করো"}</Bn></b><span className="ac-mut">{!r.pass && <>النجاح من <span className="ac-num">{CFG.passMark}%</span> · </>}<span className="ac-num">{r.pts}/{r.max}</span></span></div>
        {topics.length > 1 && <table className="ac-tbl"><tbody>{topics.map(k => <tr key={k}><td>{modName(k).ar}</td><td><span className={"g-badge ac-num " + (r.tp[k] >= CFG.passMark ? "ok" : "bad")}>{r.tp[k]}%</span></td></tr>)}</tbody></table>}</section>
      {nb}
      {r.log.length ? <section className="ac-card g-card"><h2><B t={$("ما يحتاج تصحيح", "যা ঠিক করতে হবে")} /></h2>{r.log.map((m, i) => <div key={i} className="ac-note bad"><B t={m.why} /></div>)}</section>
        : <div className="ac-note ok" style={{ textAlign: "center" }}><b>بدون أخطاء!</b> <Bn>কোনো ভুল নেই!</Bn></div>}
      {!nb && retry}
      {!r.pass && t === "mod" && station && <button className="g-btn block" onClick={() => go({ k: "lesson", id: r.modId, p: 0 })}>راجع الدرس <Bn>পাঠ আবার দেখো</Bn></button>}
      <div className="ac-btns">{nb && retry}<button className="g-btn ghost block" onClick={close}>طريقي <Bn>আমার পথ</Bn></button></div></>;
  }

  function PracIntro({ kind }) {
    const m = MODS.find(x => x.id === kind), self = practicals.filter(p => p.kind === kind && p.mode === "self").length;
    const sup = practicals.filter(p => p.kind === kind && p.mode === "sup"), ok = sup.some(p => p.pass);
    return <>{back}<div><span className="ac-eyebrow">التطبيق العملي · <Bn>হাতে-কলমে</Bn></span><h1><B t={m.name} /></h1></div>
      <section className="ac-card g-card"><ol className="ac-steps">
        <li><span className="n ac-num">1</span><span><B t={$("تدرّب وحدك على سيارة حقيقية والجوال معك: خطوة واحدة في كل شاشة.", "আসল গাড়িতে নিজে অনুশীলন করো, ফোন সাথে রাখো: প্রতি স্ক্রিনে একটি ধাপ।")} /><span className="ac-mut">تدربت <span className="ac-num">{self}</span> مرة</span></span></li>
        <li><span className="n ac-num">2</span><span><B t={$("عندما تكون جاهزاً اطلب من المشرف أن يقيّمك وأنت تغسل.", "প্রস্তুত হলে সুপারভাইজারকে বলো তোমার ধোয়া দেখে মূল্যায়ন করতে।")} /></span></li>
        <li><span className="n ac-num">3</span><span><B t={$("النجاح من 85% بلا خطوة متروكة وبلا مخالفة قاعدة.", "৮৫% থেকে পাস, কোনো ধাপ বাদ নয়, কোনো নিয়ম ভাঙা নয়।")} /></span></li></ol></section>
      {ok ? <div className="ac-note ok"><B t={$("قيّمك المشرف ونجحت في هذا التطبيق.", "সুপারভাইজার মূল্যায়ন করেছেন, তুমি পাস করেছ।")} /></div>
        : sup.length ? <div className="ac-note bad"><B t={$(`آخر تقييم للمشرف: ${sup[0].pct}% — يحتاج إعادة.`, `সুপারভাইজারের শেষ মূল্যায়ন: ${sup[0].pct}% — আবার চেষ্টা করো।`)} /></div> : null}
      <button className="g-btn primary block" onClick={() => startRun(kind)}>▶ تدريب ذاتي <Bn>নিজে অনুশীলন</Bn></button>
      <div className="ac-note"><B t={$("تقييم المشرف يُسجَّل من حساب المشرف وهو يشاهدك تغسل. يظهر هنا تلقائياً بعد حفظه.", "সুপারভাইজার তার নিজের অ্যাকাউন্ট থেকে মূল্যায়ন করবেন। সংরক্ষণের পর এখানে দেখা যাবে।")} /></div></>;
  }

  function Run() {
    const W = WASH[R.kind], steps = allSteps(W), s = steps[R.i], pi = W.phases.indexOf(s.phase);
    const secs = Math.floor((Date.now() - R.t0) / 1000);
    const quit = () => { releaseWake(); setR(null); setTab("prac"); close(); };
    const done = () => { if (R.i + 1 < steps.length) { setR({ ...R, i: R.i + 1, clip: false }); top(); } else endRun(); };
    return <>
      <div className="ac-row" style={{ justifyContent: "space-between" }}><button className="g-btn sm" onClick={quit}>✕ إنهاء <Bn>শেষ</Bn></button><span className="ac-timer ac-num" role="timer" aria-label="المؤقت">{fmtTime(secs)}</span></div>
      <div className="g-track"><i style={{ width: Math.round(R.i / steps.length * 100) + "%" }} /></div>
      <section className="ac-card g-card"><span className="ac-eyebrow">المرحلة <span className="ac-num">{pi + 1}</span>: {s.phase.name.ar} · <Bn>{s.phase.name.bn}</Bn></span>
        <div className="ac-row"><span className="ac-steps"><span className="n ac-num" style={{ width: 40, height: 40, fontSize: 17 }}>{R.i + 1}</span></span><span className="ac-mut">من <span className="ac-num">{steps.length}</span></span></div>
        <div className="ac-run-step"><B t={s.t} /></div><div className="ac-note ok"><b>علامة الإتقان:</b> <B t={s.ok} /></div></section>
      <button className="g-btn primary block ac-big" onClick={done}>تم ✓ <Bn>হয়ে গেছে</Bn></button>
      <div className="ac-btns"><button className="g-btn block" disabled={!R.i} onClick={() => setR({ ...R, i: R.i - 1, clip: false })}>السابقة <Bn>আগের</Bn></button>
        <button className="g-btn block" aria-pressed={R.clip} onClick={() => setR({ ...R, clip: !R.clip })}>▶ مقطع المرحلة <Bn>ভিডিও</Bn></button></div>
      {R.clip && <Clip key={s.phase.clip} clip={s.phase.clip} videos={videos} autoPlay />}</>;
  }

  function Prac() {
    const card = k => { const m = MODS.find(x => x.id === k), recs = practicals.filter(p => p.kind === k), sup = recs.filter(p => p.mode === "sup"), ok = sup.some(p => p.pass), self = recs.filter(p => p.mode === "self").length, last = sup[0];
      const open = stationState(idxOf("prac", k), st) !== "lock";
      return <section key={k} className="ac-card g-card"><div className="ac-row">{IMG[m.icon] ? <img className="ac-ico" src={IMG[m.icon]} alt="" /> : <span className="ac-ico" />}<div className="ac-grow"><h2><B t={m.name} /></h2>
        <span className="ac-mut"><span className="ac-num">{allSteps(WASH[k]).length}</span> خطوة · تدريب ذاتي: <span className="ac-num">{self}</span> مرة</span></div>
        <span className={"g-badge " + (ok ? "ok" : last ? "bad" : "")}>{ok ? "معتمد" : last ? <span className="ac-num">{last.pct}%</span> : "لم يُقيَّم"}</span></div>
        <button className="g-btn block" onClick={() => startRun(k)}>▶ تدريب ذاتي <Bn>নিজে অনুশীলন</Bn></button>
        {!open && <span className="ac-mut">يُعتمد بعد إنهاء المحطات السابقة · <Bn>আগের ধাপ শেষ হলে অনুমোদন</Bn></span>}</section>; };
    return <><section><h2><B t={$("التطبيق العملي", "হাতে-কলমে প্রয়োগ")} /></h2><p className="ac-mut" style={{ margin: "4px 0 0" }}>اغسل سيارة حقيقية والجوال معك: التدريب الذاتي يمشي معك خطوة خطوة، وتقييم المشرف هو الذي يعتمدك.</p></section>
      {card("interior")}{card("exterior")}
      <div className="ac-note"><B t={$("شرط الاعتماد: المشرف يقيّم كل خطوة على سيارة حقيقية. النجاح من 85% بلا خطوة متروكة وبلا مخالفة لأي قاعدة.", "অনুমোদনের শর্ত: সুপারভাইজার আসল গাড়িতে প্রতিটি ধাপ মূল্যায়ন করবেন। ৮৫% থেকে পাস, কোনো ধাপ বাদ নয়, কোনো নিয়ম ভাঙা নয়।")} /></div></>;
  }

  function Results() {
    const h = attempts, p = practicals.filter(x => x.mode === "sup"), avg = h.length ? Math.round(h.reduce((a, x) => a + x.pct, 0) / h.length) : null, tm = topMiss(miss, 8);
    return <>
      <section className="ac-card g-card"><h2><B t={$("نتائجي", "আমার ফলাফল")} /></h2>
        <div className="ac-stats">{[[modsDone(st) + "/" + MODS.length, "وحدات مكتملة"], [avg == null ? "—" : avg + "%", "متوسط الدقة"], [h.length, "اختبارات"], [daily.streak, "سلسلة الأيام"]].map(([val, l]) => <div key={l}><b className="ac-num">{val}</b><span>{l}</span></div>)}</div>
        <span className="ac-mut">المرحلة: {["الوحدات", "الاختبار الشامل", "التطبيق العملي", "بايكر معتمد"][stage(st)]}{certified(st) ? " ✓" : ""}</span></section>
      <section className="ac-card g-card"><h2>أفضل نتيجة لكل وحدة</h2>{MODS.map(m => { const b = st.best[m.id]; return <div key={m.id}><div className="ac-row" style={{ justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}><span>{m.name.ar}</span><b className="ac-num">{b == null ? "—" : b + "%"}</b></div>
        <div className={"g-track" + ((b || 0) >= CFG.passMark ? " ok" : "")}><i style={{ width: (b || 0) + "%" }} /></div></div>; })}</section>
      <section className="ac-card g-card"><h2>التطبيق العملي</h2>{p.length ? <div className="ac-hist">{p.slice(0, 8).map(x => <div key={x.id} className="ac-row"><div className="ac-grow"><b>{modName(x.kind).ar}</b><div className="ac-mut">المشرف: {x.evaluator_name || "—"} · {fmtDate(x.created_at)}</div></div><span className={"g-badge ac-num " + (x.pass ? "ok" : "bad")}>{x.pct}%</span></div>)}</div>
        : <p className="ac-mut" style={{ margin: 0 }}>لا يوجد تقييم مشرف بعد.</p>}</section>
      {tm.length > 0 && <section className="ac-card g-card"><h2><B t={$("نقاط تحتاج تصحيح", "যা ঠিক করতে হবে")} /></h2>{tm.map((m, i) => <div key={i} className="ac-note bad"><B t={m.why} /></div>)}</section>}
      <section className="ac-card g-card"><h2>سجل المحاولات</h2>{h.length ? <div className="ac-hist">{h.slice(0, 15).map(x => <div key={x.id} className="ac-row"><div className="ac-grow"><b>{modName(x.module).ar}</b><div className="ac-mut">{fmtDate(x.created_at)}{wrongsOf(x).length ? ` · أخطاء: ${wrongsOf(x).length}` : ""}</div></div><span className={"g-badge ac-num " + (x.pct >= CFG.passMark ? "ok" : "bad")}>{x.pct}%</span></div>)}</div>
        : <p className="ac-mut" style={{ margin: 0 }}>لا توجد محاولات بعد.</p>}</section>
    </>;
  }
}
