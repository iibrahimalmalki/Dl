// رسائل الخطأ لبوابة البايكر — بلا نصوص تقنية.
// humanError(err, ctx) → { key, code, ar, bn, action }
//   ctx: { photo: رقم الصورة عند فشل رفعها، kind: "time" | "nobike" | "login" }
// النص التقني يُسجَّل في console.error فقط؛ يظهر للبايكر «رمز» قصير يرسله للإدارة (E-RLS…).
export const ADMIN_WA = "966566884419";

const T = {
  net: { code: "E-NET", action: "retry",
    ar: "لم يُحفظ لأن الإنترنت مقطوع. مدخلاتك محفوظة، أعد المحاولة حين تعود الشبكة.",
    bn: "ইন্টারনেট নেই, তাই সংরক্ষণ হয়নি। আপনার তথ্য আছে, নেট এলে আবার চেষ্টা করুন।" },
  login: { code: "E-LOGIN", action: "whatsapp",
    ar: "رقم البايكر أو كلمة المرور غير صحيح. تأكد منهما، أو تواصل مع الإدارة.",
    bn: "বাইকার নম্বর বা পাসওয়ার্ড ভুল। আবার দেখুন, অথবা ম্যানেজমেন্টের সাথে যোগাযোগ করুন।" },
  session: { code: "E-AUTH", action: "login",
    ar: "انتهت جلستك. سجّل الدخول مرة أخرى، ومدخلاتك محفوظة.",
    bn: "আপনার সেশন শেষ হয়েছে। আবার লগইন করুন, তথ্য সংরক্ষিত আছে।" },
  rls: { code: "E-RLS", action: "whatsapp",
    ar: "حسابك لا يملك صلاحية هذا الإجراء. أرسل الرمز للإدارة.",
    bn: "আপনার অ্যাকাউন্টে এই কাজের অনুমতি নেই। কোডটি ম্যানেজমেন্টকে পাঠান।" },
  upload: { code: "E-UPLOAD", action: "retry",
    ar: n => `لم تُرفع الصورة رقم ${n} لأن الشبكة ضعيفة. أعد المحاولة، وسنكمل من حيث توقفنا.`,
    bn: n => `ছবি ${n} আপলোড হয়নি, নেট দুর্বল। আবার চেষ্টা করুন, যেখানে থেমেছে সেখান থেকে চলবে।` },
  image: { code: "E-IMG", action: "camera",
    ar: "هذه الصورة لا تُقبل. التقطها من الكاميرا مباشرة.",
    bn: "এই ছবি গ্রহণযোগ্য নয়। সরাসরি ক্যামেরা দিয়ে তুলুন।" },
  time: { code: "E-TIME", action: "now",
    ar: "الوقت الذي أدخلته غير مقبول. يجب أن يكون خلال آخر 12 ساعة وليس في المستقبل.",
    bn: "এই সময় গ্রহণযোগ্য নয়। গত ১২ ঘণ্টার মধ্যে হতে হবে।" },
  dup: { code: "E-DUP", action: "view",
    ar: "هذا مسجَّل من قبل، فلا حاجة لتسجيله مرة ثانية.",
    bn: "এটি আগেই রেকর্ড করা আছে।" },
  nobike: { code: "E-BIKE", action: "whatsapp",
    ar: "لا توجد دراجة باسمك بعد، فلا يمكن فتح النموذج. تواصل مع الإدارة لإسنادها.",
    bn: "আপনার নামে এখনো বাইক নেই। ম্যানেজমেন্টকে জানান।" },
  unknown: { code: "E-SRV", action: "retry",
    ar: "حصل خطأ عندنا ولم يُحفظ. مدخلاتك محفوظة. أعد المحاولة، وإن تكرر أرسل الرمز للإدارة.",
    bn: "আমাদের দিকে সমস্যা হয়েছে, সংরক্ষণ হয়নি। আবার চেষ্টা করুন, না হলে কোড পাঠান।" },
};

// نص الخطأ ورمزه وحالته من أي شكل (Error، خطأ Supabase/PostgREST، خطأ التخزين، نص)
function parts(err) {
  if (err == null) return { text: "", code: "", status: 0 };
  if (typeof err === "string") return { text: err, code: "", status: 0 };
  const text = [err.message, err.msg, err.error_description, err.error, err.details, err.hint, err.name].filter(x => typeof x === "string").join(" | ");
  return { text, code: String(err.code || err.error_code || ""), status: Number(err.status || err.statusCode || 0) || 0 };
}

export function errorKey(err, ctx = {}) {
  if (ctx.kind === "nobike" || (err && err.code === "NO_BIKE")) return "nobike";
  const { text, code, status } = parts(err);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const isNet = offline || /failed to fetch|networkerror|network request failed|load failed|err_internet|err_network|timed? ?out|fetch failed/i.test(text);
  if (/invalid login credentials|invalid_credentials/i.test(text + " " + code)) return "login";
  if (status === 413 || /payload too large|maximum allowed size|exceeded the maximum|invalid_mime_type|mime type|not supported.*(image|type)/i.test(text)) return "image";
  if (code === "42501" || /row-level security|permission denied|not allowed/i.test(text)) return "rls";
  if (status === 401 || /jwt expired|invalid jwt|jwt|refresh token|session (not found|missing|expired)|auth session missing/i.test(text) || code === "PGRST301") return "session";
  if (ctx.photo != null) return "upload";
  if (isNet) return "net";
  if (ctx.kind === "time" || /received_at/i.test(text)) return "time";
  if (code === "23505" || /duplicate key|already exists/i.test(text)) return "dup";
  return "unknown";
}

export function humanError(err, ctx = {}) {
  const key = errorKey(err, ctx), t = T[key], n = ctx.photo != null ? ctx.photo : "";
  const ar = typeof t.ar === "function" ? t.ar(n) : t.ar, bn = typeof t.bn === "function" ? t.bn(n) : t.bn;
  try { if (err != null && typeof console !== "undefined") console.error("[" + t.code + "]", err); } catch (e) { /* */ }
  return { key, code: t.code, ar, bn, action: t.action };
}

// رابط واتساب الإدارة مع الرمز
export const adminWaLink = (code, who) => "https://wa.me/" + ADMIN_WA + "?text=" +
  encodeURIComponent(`السلام عليكم، واجهت مشكلة في بوابة البايكر${who ? " (" + who + ")" : ""}. الرمز: ${code || "—"}\nআসসালামু আলাইকুম, বাইকার পোর্টালে সমস্যা হয়েছে। কোড: ${code || "—"}`);

// تطبيع الإدخال: أرقام عربية/فارسية/بنغالية ← لاتينية، وحذف كل المسافات
export function normalizeId(v) {
  return String(v || "")
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09E6))
    .replace(/\s+/g, "");
}
