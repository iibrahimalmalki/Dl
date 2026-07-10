// ═══════════════════════════════════════════════════════
// محرك القرار الذكي المحلي — دلو ورغوة
// نظام تحليل وتوصية بدون أي API خارجي
// ═══════════════════════════════════════════════════════

// ─── معيار أريفول الذهبي (المرجع الأعلى) ───
export const ARIFUL_BENCHMARK = {
  monthly_washes: 205,
  complaints: 0,
  retention_risk: "high_value", // الأعلى أداءً = أعلى خطر مغادرة
  breakeven: 181,
  safe_target_min: 210,
};

// ─── قاموس الكلمات المفتاحية (عربي/إنجليزي/بنغالي) ───
const KEYWORDS = {
  // إجابات إيجابية — تدل على مسؤولية ونضج
  positive: {
    ar: ["أبلغ","أشكو","أتواصل","أحل","بالتفاهم","أتحمل","أعتذر","صبور","أنتظر","أوضح","أشرح","احترام","التزام","دعم","أساعد"],
    en: ["inform","report","contact","resolve","patient","apologize","explain","respect","commit","support","help","wait","calm"],
    bn: ["জানাই","অপেক্ষা","সাহায্য","ধৈর্য","ব্যাখ্যা"]
  },
  // إجابات سلبية — تدل على مخاطرة أو عدم نضج
  negative: {
    ar: ["لا أعرف","لا أدري","لا أتذكر","لن أفعل","لا شيء","أتجاهل","أرفض","أغضب","أترك"],
    en: ["nothing","don't know","not sure","ignore","refuse","angry","quit","leave"],
    bn: ["জানি না","কিছু না","রাগ","ছেড়ে"]
  },
  // مؤشرات خطر احتفاظ (سبب ترك العمل)
  retention_risk: {
    ar: ["راتب","أجر","مال","فلوس","دفع متأخر","لم يصرف","ظلم","كفيل"],
    en: ["salary","money","pay","wage","unpaid","delayed"],
    bn: ["বেতন","টাকা","পেমেন্ট"]
  },
  // مؤشرات كفاءة فنية (وصف الغسيل)
  technical_competence: {
    ar: ["ماء","صابون","منظف","تجفيف","فرشاة","إسفنجة","شطف","تلميع","خطوة","أولاً","ثانياً"],
    en: ["water","soap","detergent","dry","brush","sponge","rinse","polish","step","first","then"],
    bn: ["পানি","সাবান","শুকানো","ব্রাশ"]
  }
};

function countMatches(text, dict) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  Object.values(dict).forEach(langWords => {
    langWords.forEach(w => { if (lower.includes(w.toLowerCase())) count++; });
  });
  return count;
}

function textQualityScore(text) {
  if (!text || !text.trim()) return 0;
  const len = text.trim().length;
  const words = text.trim().split(/\s+/).length;
  if (len < 5) return 1;
  if (words < 3) return 3;
  if (words < 8) return 6;
  return 9;
}

// ─── تحليل نصي لإجابة واحدة ───
function analyzeAnswer(text) {
  if (!text || !text.trim()) return { score: 0, flag: "لم يُجب" };
  const pos = countMatches(text, KEYWORDS.positive);
  const neg = countMatches(text, KEYWORDS.negative);
  const quality = textQualityScore(text);
  let score = quality;
  score += pos * 1.5;
  score -= neg * 2;
  score = Math.max(0, Math.min(10, score));
  let flag = null;
  if (neg > 0) flag = "⚠️ إجابة سلبية أو غير مبالية";
  else if (quality <= 3) flag = "⚠️ إجابة مختصرة جداً";
  else if (pos > 0) flag = "✅ إجابة ناضجة";
  return { score, flag, pos, neg, quality };
}

// ─── المحور 1: اللياقة البدنية (15%) ───
function scorePhysical(a) {
  const age = Number(a.age) || 0;
  const height = Number(a.height_cm) || 0;
  const weight = Number(a.weight_kg) || 0;
  const bmi = height > 0 ? weight / ((height/100) ** 2) : 0;
  let score = 5;
  const notes = [];
  if (age >= 25 && age <= 30) { score += 3; notes.push("العمر في الذروة المثالية (25-30)"); }
  else if (age <= 33) { score += 2; notes.push("العمر مناسب"); }
  else if (age <= 38) { score += 1; notes.push("العمر مقبول لكن أقل مثالية"); }
  if (bmi >= 18.5 && bmi <= 25) { score += 2; notes.push("مؤشر كتلة جسم صحي"); }
  else if (bmi <= 28) { score += 1; }
  else { notes.push("⚠️ مؤشر كتلة جسم مرتفع — قد يؤثر على التحمل"); }
  return { score: Math.min(10, score), notes, bmi: Math.round(bmi*10)/10 };
}

// ─── المحور 2: المسؤولية (25%) ───
function scoreResponsibility(a) {
  let score = 4;
  const notes = [];
  if (a.marital_status === "married") { score += 2.5; notes.push("متزوج — دافع مالي والتزام أعلى"); }
  const children = Number(a.children_count) || 0;
  if (children === 1 || children === 2) { score += 2; notes.push(`${children} أبناء — مسؤولية متوازنة`); }
  else if (children >= 3) { score += 1; notes.push(`${children} أبناء — عبء مالي أكبر، دافع أقوى`); }
  if (a.has_license) { score += 1.5; notes.push("رخصة قيادة موجودة — جاهزية فورية"); }
  else { notes.push("⚠️ لا يملك رخصة — يحتاج وقت استخراج"); }
  return { score: Math.min(10, score), notes };
}

// ─── المحور 3: الموقع الجغرافي (استيراد من geoScoring) ───
function scoreGeo(a, calcGeoScore) {
  if (!a.bangladesh_district || !calcGeoScore) return { score: 5, notes: ["لا توجد بيانات جغرافية"] };
  const geo = calcGeoScore(a.bangladesh_district);
  if (!geo) return { score: 5, notes: ["منطقة غير معروفة في قاعدة البيانات"] };
  const notes = [`المنطقة: ${a.bangladesh_district} — ${geo.score}/100`];
  if (geo.instant_reject) notes.push("🔴 خطر صحي أو أمني — إقصاء فوري حسب السياسة");
  return { score: geo.score / 10, notes, zone: geo.zone, instant_reject: geo.instant_reject };
}

// ─── المحور 4: الكفاءة الفنية (30%) ───
function scoreTechnical(a) {
  const desc = a.car_wash_description || "";
  const techMatches = countMatches(desc, { tech: KEYWORDS.technical_competence.ar.concat(KEYWORDS.technical_competence.en) });
  const quality = textQualityScore(desc);
  let score = quality * 0.6 + Math.min(techMatches, 5) * 0.8;
  score = Math.min(10, score);
  const notes = [];
  if (techMatches >= 3) notes.push("✅ وصف يعكس خبرة عملية حقيقية");
  else if (techMatches >= 1) notes.push("وصف أساسي — خبرة محدودة الوضوح");
  else notes.push("⚠️ وصف ضعيف جداً — لا يعكس معرفة فنية واضحة");
  if (a.driving_video_url) { score = Math.min(10, score + 1); notes.push("📹 يوجد فيديو قيادة — يحتاج مراجعة يدوية"); }
  return { score, notes };
}

// ─── المحور 5: السلوكيات (30%) ───
function scoreBehavioral(a) {
  const answers = [a.q1_client_refusal, a.q2_equipment_damage, a.q3_left_previous_job, a.q4_salary_deduction, a.q5_one_year_goal, a.q6_difficult_colleague];
  const interviewAns = a.interview_answers ? Object.values(a.interview_answers) : [];
  const allAnswers = [...answers, ...interviewAns];
  const analyzed = allAnswers.map(analyzeAnswer);
  const validAnalyzed = analyzed.filter(x => x.score > 0);
  const avgScore = validAnalyzed.length ? validAnalyzed.reduce((s,x)=>s+x.score,0) / validAnalyzed.length : 0;
  const notes = [];
  const negFlags = analyzed.filter(x => x.flag && x.flag.includes("سلبية")).length;
  const shortFlags = analyzed.filter(x => x.flag && x.flag.includes("مختصرة")).length;
  if (negFlags > 0) notes.push(`⚠️ ${negFlags} إجابة سلبية أو غير مبالية — راجعها يدوياً`);
  if (shortFlags >= 2) notes.push(`⚠️ ${shortFlags} إجابات مختصرة جداً — قد يدل على قلة اهتمام`);
  if (negFlags === 0 && shortFlags === 0 && validAnalyzed.length > 0) notes.push("✅ إجابات ناضجة ومتزنة بشكل عام");
  // فحص خاص لسبب ترك العمل
  const leftReason = a.q3_left_previous_job || "";
  const salaryRisk = countMatches(leftReason, { risk: KEYWORDS.retention_risk.ar.concat(KEYWORDS.retention_risk.en) });
  let retentionFlag = null;
  if (salaryRisk > 0) { retentionFlag = "💰 ترك العمل بسبب الراتب — قد يكرر السلوك إن لم يشعر بالإنصاف"; }
  return { score: avgScore, notes, retentionFlag };
}

// ─── محرك القرار الرئيسي ───
export function analyzeApplicantLocal(a, calcGeoScore) {
  const phys = scorePhysical(a);
  const resp = scoreResponsibility(a);
  const geo = scoreGeo(a, calcGeoScore);
  const tech = scoreTechnical(a);
  const behav = scoreBehavioral(a);

  // معادلة الأوزان المعتمدة (نفس نظام Claude): فني 30% سلوكي 30% مسؤولية 25% لياقة 15%
  // + معامل تعديل جغرافي كمؤشر إضافي لا يدخل في المعادلة الأساسية
  const total = (phys.score * 0.15) + (resp.score * 0.25) + (tech.score * 0.30) + (behav.score * 0.30);

  let classification = "rejected";
  if (geo.instant_reject) classification = "rejected";
  else if (total >= 8) classification = "strong";
  else if (total >= 6.5) classification = "accepted";
  else if (total >= 5) classification = "needs_interview";

  // ─── توليد التوصية النهائية ───
  const allNotes = [...phys.notes, ...resp.notes, ...geo.notes, ...tech.notes, ...behav.notes];
  const strengths = allNotes.filter(n => n.includes("✅"));
  const weaknesses = allNotes.filter(n => n.includes("⚠️") || n.includes("🔴"));

  let recommendation = "";
  if (geo.instant_reject) {
    recommendation = "رفض فوري — المنطقة الجغرافية تحمل خطراً صحياً أو أمنياً حسب سياسة الاستقطاب المعتمدة.";
  } else if (classification === "strong") {
    recommendation = `مرشح قوي (${total.toFixed(1)}/10) — يُنصح بالقبول المباشر والانتقال لمرحلة التوظيف.`;
  } else if (classification === "accepted") {
    recommendation = `مرشح مقبول (${total.toFixed(1)}/10) — أداء جيد بشكل عام، يُنصح بالمتابعة نحو التوظيف مع مراعاة الملاحظات.`;
  } else if (classification === "needs_interview") {
    recommendation = `يحتاج مقابلة إضافية (${total.toFixed(1)}/10) — نقاط القوة والضعف متقاربة، القرار يحتاج تقييماً بشرياً مباشراً.`;
  } else {
    recommendation = `غير مناسب حالياً (${total.toFixed(1)}/10) — الدرجة الكلية أقل من الحد الأدنى المقبول.`;
  }
  if (behav.retentionFlag) recommendation += ` ${behav.retentionFlag}`;

  const arifulComparison = `مقارنة بمعيار أريفول (${ARIFUL_BENCHMARK.monthly_washes} غسلة/شهر، صفر شكاوى): ` +
    (total >= 7.5 ? "يقترب من مستوى الأداء المرجعي إذا أثبت نفسه ميدانياً." :
     total >= 6 ? "أداء متوسط — يحتاج إشرافاً أقرب في الشهر الأول لمحاكاة معايير أريفول." :
     "فجوة واضحة عن المعيار المرجعي — لا يُنصح بالمقارنة الآن دون تجربة ميدانية.");

  return {
    score_total: Math.round(total * 100) / 100,
    score_physical: Math.round(phys.score * 100) / 100,
    score_responsibility: Math.round(resp.score * 100) / 100,
    score_technical: Math.round(tech.score * 100) / 100,
    score_behavioral: Math.round(behav.score * 100) / 100,
    geo_score: geo.score ? Math.round(geo.score * 10) / 10 : null,
    classification,
    strengths: strengths.length ? strengths : ["لا توجد نقاط قوة بارزة بعد"],
    weaknesses: weaknesses.length ? weaknesses : ["لا توجد نقاط ضعف حرجة"],
    technical_notes: tech.notes.join(" — "),
    behavioral_notes: behav.notes.join(" — "),
    recommendation,
    ariful_comparison: arifulComparison,
    engine: "local", // للتمييز عن تحليل Claude
    analyzed_at: new Date().toISOString(),
  };
}

// ─── سجل التعلم (يُخزَّن محلياً في localStorage مبدئياً) ───
const LEARNING_KEY = "dalu_learning_log";

export function logOutcome(applicantId, decision, outcome) {
  try {
    const log = JSON.parse(localStorage.getItem(LEARNING_KEY) || "[]");
    log.push({ applicantId, decision, outcome, timestamp: new Date().toISOString() });
    localStorage.setItem(LEARNING_KEY, JSON.stringify(log));
  } catch (e) { console.log("Learning log error", e); }
}

export function getLearningStats() {
  try {
    const log = JSON.parse(localStorage.getItem(LEARNING_KEY) || "[]");
    return {
      total_decisions: log.length,
      accepted: log.filter(l => l.decision === "accepted" || l.decision === "strong").length,
      rejected: log.filter(l => l.decision === "rejected").length,
      ready_for_calibration: log.length >= 30, // بعد 30 قراراً يمكن بدء المعايرة
    };
  } catch (e) { return { total_decisions: 0, ready_for_calibration: false }; }
}
