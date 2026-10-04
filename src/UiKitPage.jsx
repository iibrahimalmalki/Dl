// #ui-kit — صفحة داخلية للمالك: مكوّنات تغذية الراجعة في بوابة البايكر بكل حالاتها.
import { useState } from "react";
import { useToast } from "./ui";
import { humanError } from "./errors";
import { KitStyle, Btn, ErrorNote, FieldErr, UploadBar, Skel, StickyBar, OfflineHint, useConfirm, Bn } from "./uiKit";

const CSS = `
.uk{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:14px;padding:4px 0 30px}
.uk-card{padding:16px 18px;border-radius:18px;display:flex;flex-direction:column;gap:10px}
.uk h2{margin:0;font-size:16px;font-weight:900;color:var(--ink)}
.uk-row{display:flex;gap:8px;flex-wrap:wrap}.uk-row>*{flex:1;min-width:140px}
.uk-mut{font-size:12.5px;color:var(--mut)}
.uk-net{position:relative;padding:6px 12px;background:var(--bad);color:#fff;font-size:12.5px;font-weight:800;text-align:center;border-radius:10px}
.uk-net .k-bn{display:block;font-weight:600;font-size:11.5px}
.uk-scroll{max-height:220px;overflow:auto;border:1px dashed var(--line-2);border-radius:14px;position:relative}
.uk-scroll .k-sticky{margin:0;bottom:0!important}
`;
// أمثلة أخطاء حقيقية لكل حالة من الحالات العشر
const SAMPLES = [
  ["لا إنترنت", new TypeError("Failed to fetch"), {}],
  ["دخول خاطئ", { message: "Invalid login credentials", code: "invalid_credentials", status: 400 }, {}],
  ["انتهت الجلسة", { message: "JWT expired", code: "PGRST301" }, {}],
  ["لا صلاحية", { code: "42501", message: "new row violates row-level security policy" }, {}],
  ["فشل رفع صورة", new TypeError("Failed to fetch"), { photo: 3 }],
  ["صورة مرفوضة", { statusCode: "413", message: "The object exceeded the maximum allowed size" }, { photo: 2 }],
  ["وقت خارج المدى", { message: "received_at out of range" }, {}],
  ["تكرار", { code: "23505", message: "duplicate key value" }, {}],
  ["لا دراجة", null, { kind: "nobike" }],
  ["خطأ خادم", { message: "Internal Server Error", status: 500 }, {}],
];

export default function UiKitPage() {
  const toast = useToast();
  const [dlg, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(3);
  const [pick, setPick] = useState(0);
  const [answer, setAnswer] = useState(null);
  const e = humanError(SAMPLES[pick][1], SAMPLES[pick][2]);
  return <div className="uk"><KitStyle /><style>{CSS}</style>
    <section className="uk-card g-card"><h2>مكوّنات بوابة البايكر · UI kit</h2>
      <span className="uk-mut">للمالك فقط. تُستعمل من <code>src/uiKit.jsx</code> و<code>src/errors.js</code>.</span></section>

    <section className="uk-card g-card"><h2>الأزرار</h2>
      <span className="uk-mut">أساسي (ممتلئ) · ثانوي (بإطار) · نصّي. زر أساسي واحد في كل شاشة.</span>
      <div className="uk-row"><Btn kind="primary" bn="সংরক্ষণ">حفظ</Btn><Btn kind="secondary" bn="আগের">السابق</Btn><Btn kind="text">تعديل</Btn></div>
      <div className="uk-row"><Btn kind="primary" busy bn="সংরক্ষণ হচ্ছে…">جارٍ الحفظ…</Btn><Btn kind="primary" disabled bn="নিষ্ক্রিয়">معطّل</Btn><Btn kind="secondary" busy>انتظار</Btn></div>
      <Btn kind="primary" block big busy={busy} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1800); }} bn="চাপ দিয়ে দেখুন">جرّب حالة الانشغال</Btn></section>

    <section className="uk-card g-card"><h2>التوست (نجاح، 3 ثوانٍ)</h2>
      <div className="uk-row"><Btn kind="secondary" onClick={() => toast.ok("تم حفظ الاستلام ✓", "সংরক্ষিত", 3000)}>نجاح</Btn>
        <Btn kind="secondary" onClick={() => toast.warn("تنبيه", "সতর্কতা", 3000)}>تنبيه</Btn></div></section>

    <section className="uk-card g-card"><h2>الهيكل (Skeleton)</h2><Skel rows={3} card={false} /></section>

    <section className="uk-card g-card"><h2>شريط الشبكة</h2>
      <span className="uk-mut">يظهر ثابتاً أعلى الصفحة عندما يكون <code>navigator.onLine === false</code>، ويُعطَّل زر الحفظ.</span>
      <div className="uk-net">لا يوجد إنترنت — مدخلاتك محفوظة<Bn>ইন্টারনেট নেই — আপনার তথ্য সংরক্ষিত</Bn></div>
      <Btn kind="primary" block disabled bn="রিপোর্ট সংরক্ষণ">حفظ التقرير</Btn><OfflineHint /></section>

    <section className="uk-card g-card"><h2>رفع الصور</h2>
      <UploadBar done={up} total={10} />
      <div className="uk-row"><Btn kind="secondary" onClick={() => setUp(v => Math.max(0, v - 1))}>−</Btn><Btn kind="secondary" onClick={() => setUp(v => Math.min(10, v + 1))}>+</Btn></div></section>

    <section className="uk-card g-card"><h2>رسائل الخطأ (الحالات العشر)</h2>
      <select className="g-select" value={pick} onChange={x => setPick(+x.target.value)} aria-label="الحالة">{SAMPLES.map((x, i) => <option key={i} value={i}>{i + 1}. {x[0]}</option>)}</select>
      <ErrorNote e={e} onRetry={() => {}} onLogin={() => {}} onNow={() => {}} onView={() => {}} onCamera={() => {}} />
      <span className="uk-mut">خطأ تحقّق بجانب الحقل:</span>
      <input className="g-input k-inv" placeholder="14230" aria-label="مثال" /><FieldErr t={{ ar: "أدخل قراءة العدّاد بالأرقام.", bn: "ওডোমিটার সংখ্যায় লিখুন।" }} /></section>

    <section className="uk-card g-card"><h2>الحوار (بدل confirm)</h2>
      <Btn kind="secondary" onClick={async () => setAnswer(await ask({ title: "تأكيد البنود", titleBn: "নিশ্চিত করুন", ar: "حدّدت 4 بنود غير سليمة — هل هذا صحيح؟", bn: "আপনি 4 টি সমস্যা চিহ্নিত করেছেন — ঠিক আছে?", ok: "نعم، صحيح", okBn: "হ্যাঁ, ঠিক", cancel: "راجع البنود", cancelBn: "আবার দেখুন" }))}>افتح الحوار</Btn>
      {answer != null && <span className="uk-mut">النتيجة: {answer ? "نعم" : "رجوع"}</span>}</section>

    <section className="uk-card g-card"><h2>شريط الإجراء الثابت</h2>
      <div className="uk-scroll"><div style={{ padding: 12, height: 320 }} className="uk-mut">محتوى النموذج… مرّر للأسفل: الزر يبقى ظاهراً في أسفل الإطار.</div>
        <StickyBar><Btn kind="primary" block big bn="পরের ধাপ">التالي</Btn></StickyBar></div></section>
    {dlg}
  </div>;
}
