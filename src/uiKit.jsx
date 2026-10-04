// مكوّنات تغذية راجعة مشتركة لبوابة البايكر (وصفحة #ui-kit للمالك).
// تُحمَّل مع البوابة فقط (لا تدخل الحزمة الرئيسية): زر بحالة انشغال، حوار تأكيد، شريط الشبكة،
// شريط رفع الصور، رسالة خطأ بشرية، هيكل تحميل، شريط إجراء ثابت أسفل الشاشة.
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./ui";
import { adminWaLink } from "./errors";

export const KIT_CSS = `
.k-bn,.k-wrap :lang(bn){font-family:system-ui,-apple-system,'Noto Sans Bengali','Segoe UI',sans-serif}
.g-btn.k-btn{min-height:48px;font-size:14.5px;border-radius:13px;flex-wrap:wrap;line-height:1.35;gap:4px 8px;position:relative}
.g-btn.k-btn .k-bn{flex-basis:100%;font-size:12px;font-weight:600;opacity:.9}
.g-btn.k-btn.big{min-height:52px;font-size:15.5px;font-weight:900}
.g-btn.k-btn.block{width:100%}
.g-btn.k-btn.ghost{text-decoration:underline;text-underline-offset:3px}
.g-btn.k-btn .g-spin{width:16px;height:16px;border-width:2px;margin:0;border-color:currentColor;border-inline-end-color:transparent;border-top-color:currentColor;flex:none}
.g-btn.k-btn.is-busy{pointer-events:none}
.g-btn.k-btn.is-busy .k-lbl{opacity:.85}
/* شريط الإجراء الأساسي: ثابت أسفل الشاشة فوق الشريط السفلي، داخل تدفّق الصفحة فلا يغطّي آخر حقل */
.k-sticky{position:sticky;bottom:0;z-index:25;display:flex;flex-direction:column;gap:8px;margin:16px -18px -16px;padding:10px 18px calc(10px + env(safe-area-inset-bottom));background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-top:1px solid var(--line)}
.k-sticky.flat{margin:12px 0 0;border-radius:16px;border:1px solid var(--line)}
.k-sticky .k-row{display:flex;gap:8px}.k-sticky .k-row>*{flex:1;min-width:0}
@media(max-width:640px){.k-sticky{bottom:calc(var(--bnav-h) + env(safe-area-inset-bottom));padding-bottom:10px}
  .kb-open .k-sticky{bottom:0}.kb-open .g-bnav{display:none!important}}
/* شريط الشبكة */
.k-net{position:fixed;top:0;left:0;right:0;z-index:1300;padding:6px 12px;padding-top:max(6px,env(safe-area-inset-top));background:var(--bad);color:#fff;font-size:12.5px;font-weight:800;text-align:center;line-height:1.45}
.k-net .k-bn{display:block;font-weight:600;font-size:11.5px}
/* رسالة الخطأ */
.k-err{padding:12px 13px;border-radius:12px;background:var(--bad-bg);color:var(--bad-ink);font-size:13.5px;font-weight:700;line-height:1.65;display:flex;flex-direction:column;gap:8px}
.k-err .k-bn{display:block;font-weight:600;font-size:12.5px}
.k-err .k-code{font-size:11px;font-weight:700;opacity:.75;direction:ltr;unicode-bidi:isolate}
.k-err .g-btn{min-height:44px}
.k-ferr{margin-top:6px;font-size:12.5px;font-weight:800;color:var(--bad-ink);line-height:1.5}.k-ferr .k-bn{display:block;font-weight:600}
.k-inv{box-shadow:0 0 0 2px var(--bad)!important;border-radius:12px}
/* رفع الصور */
.k-up{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;background:var(--soft);border:1px solid var(--line);font-size:13px;font-weight:800;color:var(--ink-2)}
.k-up .k-n{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
/* هيكل التحميل */
.k-skel{display:flex;flex-direction:column;gap:10px;padding:16px 18px}
.k-skel .g-skel{height:14px}.k-skel .g-skel.h{height:22px;width:55%}.k-skel .g-skel.b{height:48px}.k-skel .g-skel.s{width:70%}
@media (prefers-reduced-motion:reduce){.g-btn.k-btn .g-spin{animation-duration:1.6s}}
`;
export const KitStyle = () => <style>{KIT_CSS}</style>;
export const Bn = ({ children }) => <span className="k-bn" lang="bn">{children}</span>;

// زر بثلاثة أنواع: primary (ممتلئ) · secondary (بإطار) · text (نصّي)
export function Btn({ kind = "primary", busy, block, big, bn, className, children, type = "button", ...p }) {
  const cls = ["g-btn", "k-btn", kind === "primary" ? "primary" : kind === "text" ? "ghost" : "", block && "block", big && "big", busy && "is-busy", className].filter(Boolean).join(" ");
  return <button type={type} {...p} disabled={busy || p.disabled} className={cls} aria-busy={busy || undefined}>
    {busy && <span className="g-spin" aria-hidden="true" />}<span className="k-lbl">{children}</span>{bn && <Bn>{bn}</Bn>}
  </button>;
}

export function useOnline() {
  const [on, setOn] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => { const u = () => setOn(navigator.onLine !== false); window.addEventListener("online", u); window.addEventListener("offline", u); return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); }; }, []);
  return on;
}
export function NetBar() {
  const on = useOnline();
  if (on) return null;
  return <div className="k-net" role="status">لا يوجد إنترنت — مدخلاتك محفوظة<Bn>ইন্টারনেট নেই — আপনার তথ্য সংরক্ষিত</Bn></div>;
}
// سبب تعطيل الحفظ عند انقطاع الشبكة (يُعرض تحت الزر)
export const OfflineHint = () => <div className="k-ferr" role="status">الحفظ متوقف حتى يعود الإنترنت<Bn>ইন্টারনেট এলে সংরক্ষণ করুন</Bn></div>;

// حوار تأكيد بدل window.confirm: const [dlg, ask] = useConfirm(); if (!(await ask({...}))) return; … {dlg}
export function useConfirm() {
  const [st, setSt] = useState(null);
  const res = useRef(null);
  const ask = useCallback(o => new Promise(r => { res.current = r; setSt(o || {}); }), []);
  const close = v => { const r = res.current; res.current = null; setSt(null); r && r(v); };
  // بوابة على body: أي أب بطبقة (z-index) يحبس الحوار تحت الشريط السفلي
  const node = st && createPortal(<Modal open onClose={() => close(false)} title={<span>{st.title || "تأكيد"}{st.titleBn && <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--mut)" }}><Bn>{st.titleBn}</Bn></span>}</span>}
    foot={<div style={{ display: "flex", gap: 8, width: "100%", flexDirection: "row-reverse" }}>
      <Btn kind="primary" block onClick={() => close(true)} bn={st.okBn || "ঠিক আছে"}>{st.ok || "نعم"}</Btn>
      <Btn kind="secondary" block onClick={() => close(false)} bn={st.cancelBn || "ফিরে যান"}>{st.cancel || "رجوع"}</Btn></div>}>
    <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.7 }}>{st.ar}{st.bn && <Bn><span style={{ display: "block", fontWeight: 600, color: "var(--mut)" }}>{st.bn}</span></Bn>}</div>
  </Modal>, document.body);
  return [node, ask];
}

// رسالة خطأ بشرية: e = humanError(...) → ماذا حصل + ماذا تفعل + زر الإجراء + رمز صغير
export function ErrorNote({ e, who, onRetry, onLogin, onNow, onView, onCamera, busy }) {
  const ref = useRef(null);
  // تظهر الرسالة في وسط الشاشة (لا تختفي خلف شريط الحفظ الثابت)
  useEffect(() => { if (e && ref.current && ref.current.scrollIntoView) ref.current.scrollIntoView({ block: "center", behavior: "smooth" }); }, [e]);
  if (!e) return null;
  const wa = <a className="g-btn k-btn block" href={adminWaLink(e.code, who)} target="_blank" rel="noopener noreferrer">💬 تواصل مع الإدارة<Bn>ম্যানেজমেন্টকে লিখুন</Bn></a>;
  const act = e.action === "retry" && onRetry ? <Btn kind="secondary" block busy={busy} onClick={onRetry} bn="আবার চেষ্টা করুন">أعد المحاولة</Btn>
    : e.action === "login" ? <Btn kind="secondary" block onClick={onLogin} bn="আবার লগইন">تسجيل الدخول</Btn>
    : e.action === "now" && onNow ? <Btn kind="secondary" block onClick={onNow} bn="এখন">الآن</Btn>
    : e.action === "view" && onView ? <Btn kind="secondary" block onClick={onView} bn="রেকর্ড দেখুন">عرض السجل</Btn>
    : e.action === "camera" && onCamera ? <Btn kind="secondary" block onClick={onCamera} bn="ক্যামেরা খুলুন">افتح الكاميرا</Btn>
    : null;
  return <div className="k-err" role="alert" ref={ref}>
    <div>{e.ar}<Bn>{e.bn}</Bn></div>
    {act}{(e.action === "whatsapp" || e.key === "rls" || e.key === "unknown") && wa}
    <span className="k-code">رمز · কোড: {e.code}</span>
  </div>;
}
// خطأ تحقق بجانب الحقل نفسه
export const FieldErr = ({ t, id }) => t ? <div className="k-ferr" id={id} role="alert">{t.ar}<Bn>{t.bn}</Bn></div> : null;

// تقدّم رفع الصور: «3 / 10» + شريط
export function UploadBar({ done, total }) {
  if (!total) return null;
  return <div className="k-up" role="status" aria-live="polite">
    <span>رفع الصور <span className="k-n">{done} / {total}</span> · <Bn>ছবি আপলোড</Bn></span>
    <div className="g-track" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}><i style={{ width: Math.round(done / total * 100) + "%" }} /></div>
  </div>;
}

// هيكل تحميل بدل «جارٍ التحميل»
export function Skel({ rows = 3, card = true }) {
  const body = <div className="k-skel" aria-busy="true" aria-label="جارٍ التحميل · লোড হচ্ছে"><div className="g-skel h" />{Array.from({ length: rows }).map((_, i) => <div key={i} className={"g-skel" + (i % 3 === 2 ? " s" : "")} />)}<div className="g-skel b" /></div>;
  return card ? <div className="bp-card g-card">{body}</div> : body;
}

// شريط الإجراء الأساسي الثابت
export const StickyBar = ({ children, flat }) => <div className={"k-sticky" + (flat ? " flat" : "")}>{children}</div>;

// لوحة المفاتيح مفتوحة (حقل نصي مركّز على شاشة صغيرة) ⇒ يُخفى الشريط السفلي حتى لا يغطّي الزر
export function useKeyboardOpen() {
  useEffect(() => {
    const b = document.body;
    const isField = t => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !/^(checkbox|radio|file|button|submit)$/i.test(t.type || "");
    const on = e => { if (isField(e.target) && window.innerWidth <= 640) b.classList.add("kb-open"); };
    const off = () => setTimeout(() => { if (!isField(document.activeElement)) b.classList.remove("kb-open"); }, 50);
    document.addEventListener("focusin", on); document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); b.classList.remove("kb-open"); };
  }, []);
}

// مسودة نموذج في sessionStorage (بلا الصور) — تُمسح بعد الحفظ
export function loadDraft(key) { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
export function saveDraft(key, v) { try { if (v == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* التخزين غير متاح */ } }
