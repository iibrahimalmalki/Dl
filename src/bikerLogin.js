// دخول البايكر: تحويل ما يكتبه البايكر إلى بريد الحساب، واستخراج «رقم البايكر» من البريد لرسالة الترحيب.
// الحسابات: biker<رقم>@dalu.sa (مثل biker1700@dalu.sa) أو biker.<اسم>@dalu.sa (مثل biker.abed@dalu.sa).
import { normalizeId } from "./errors";

const DOMAIN = "@dalu.sa";
export function idToEmail(v) {
  const t = normalizeId(v).toLowerCase();               // أرقام عربية/بنغالية ← لاتينية، بلا مسافات
  if (!t) return "";
  if (t.includes("@")) return t;                        // بريد كامل يُستخدم كما هو
  if (/^biker\.?[a-z0-9._-]+$/.test(t)) return t + DOMAIN; // biker1700 أو biker.abed
  if (/^\d+$/.test(t)) return `biker${t}${DOMAIN}`;      // 1700
  return `biker.${t}${DOMAIN}`;                         // abed
}

// biker1700@dalu.sa ← 1700 ، biker.abed@dalu.sa ← abed ؛ غير ذلك ⇒ البريد كما هو
export function bikerLoginId(email) {
  const m = /^biker\.?([^@]+)@dalu\.sa$/i.exec(String(email || "").trim());
  return m ? m[1].toLowerCase() : String(email || "");
}
// هل للبريد صيغة دخول البايكر (يكفيه كتابة الرقم)؟
export const hasBikerAlias = email => /^biker\.?[^@]+@dalu\.sa$/i.test(String(email || "").trim());
