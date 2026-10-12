// «بيئة الاختبار الدائمة» (docs/design/test_sandbox.md): السجل التجريبي (is_test) يظهر بشارة، لكنه خارج كل مجموع ومتوسط وترتيب.
// منطق نقي بلا DOM ولا Supabase.

export const isTest = r => !!(r && r.is_test);
export const realOnly = rows => (rows || []).filter(r => !isTest(r));
// التجريبي آخر القائمة، مع بقاء الترتيب الأصلي داخل كل مجموعة
export const testLast = (rows, isT = isTest) => { const a = rows || []; return [...a.filter(r => !isT(r)), ...a.filter(isT)]; };
// معرّفات السجلات التجريبية من قائمة فيها is_test (دراجات أو موظفون)
export const testIds = rows => new Set((rows || []).filter(isTest).map(r => r.id));
// صفوف مفتاحها (vehicle_id افتراضياً) يشير إلى سجل تجريبي: تُعلَّم test وتُؤخَّر
export const markTest = (rows, ids, key = "vehicle_id") =>
  testLast((rows || []).map(r => ({ ...r, test: !!(ids && ids.has(r[key])) })), r => r.test);
// للعدّادات: الصفوف غير التجريبية فقط
export const realBy = (rows, ids, key = "vehicle_id") => (rows || []).filter(r => !(ids && ids.has(r[key])));
