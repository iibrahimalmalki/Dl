// فحص وضوح الصورة في المتصفح قبل قبولها: الدقة، والإضاءة (مظلمة/محروقة)، والحدة (تباين لابلاس).
// analyzeGray و judgePhoto نقيتان (للاختبار)؛ checkPhoto تقرأ الملف عبر canvas.

export const QUALITY = {
  minSide: 800,        // أقل ضلع بالبكسل
  sample: 512,         // الضلع الأطول للصورة المصغّرة المستخدمة في الفحص
  darkMean: 45,        // متوسط سطوع أقل من هذا ⇒ مظلمة
  darkShare: 0.75,     // أو ¾ البكسلات شبه سوداء (<30)
  brightMean: 235,     // متوسط أعلى من هذا ⇒ محروقة
  brightShare: 0.6,    // أو 60% من البكسلات شبه بيضاء (>245)
  minSharp: 25,        // تباين لابلاس أقل من هذا ⇒ ضبابية/مهتزة
};

// gray: مصفوفة سطوع 0..255 بطول w*h ⇒ {mean, dark, bright, sharp}
export function analyzeGray(gray, w, h) {
  const n = w * h; let sum = 0, dark = 0, bright = 0;
  for (let i = 0; i < n; i++) { const v = gray[i]; sum += v; if (v < 30) dark++; else if (v > 245) bright++; }
  // لابلاس 4-جوار على البكسلات الداخلية ⇒ التباين (variance)
  let s = 0, s2 = 0, m = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
    s += l; s2 += l * l; m++;
  }
  const lm = m ? s / m : 0;
  return { mean: n ? sum / n : 0, dark: n ? dark / n : 0, bright: n ? bright / n : 0, sharp: m ? s2 / m - lm * lm : 0 };
}
export function rgbaToGray(data) {
  const g = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) g[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return g;
}

const R = (code, ar, bn) => ({ code, ar, bn });
// {width, height, stats} ⇒ null (مقبولة) أو {code, ar, bn}
export function judgePhoto({ width, height, stats }, q = QUALITY) {
  if (Math.min(width || 0, height || 0) < q.minSide)
    return R("small", `دقة الصورة منخفضة (${Math.min(width || 0, height || 0)} بكسل). صوّر بكاميرا الجوال مباشرة.`, "ছবির রেজোলিউশন কম। সরাসরি ফোনের ক্যামেরা দিয়ে তুলুন।");
  if (!stats) return null;
  if (stats.mean < q.darkMean || stats.dark > q.darkShare)
    return R("dark", "الصورة مظلمة جداً. صوّر في مكان مضاء أو شغّل الفلاش.", "ছবি খুব অন্ধকার। আলোতে বা ফ্ল্যাশ দিয়ে তুলুন।");
  if (stats.mean > q.brightMean || stats.bright > q.brightShare)
    return R("bright", "الصورة محروقة من الضوء. ابتعد عن الشمس المباشرة وأعد التصوير.", "ছবিতে আলো বেশি। সরাসরি রোদ এড়িয়ে আবার তুলুন।");
  if (stats.sharp < q.minSharp)
    return R("blur", "الصورة غير واضحة، قرّب الكاميرا وثبّت يدك وأعد التصوير.", "ছবি পরিষ্কার নয়, ক্যামেরা কাছে আনুন, হাত স্থির রাখুন এবং আবার তুলুন।");
  return null;
}

// ملف صورة ⇒ null (مقبولة) أو {code, ar, bn}. إن تعذّر فكّ الصورة في المتصفح (صيغة غير مدعومة) تُقبل كما هي.
export async function checkPhoto(file, q = QUALITY) {
  let bmp = null, url = null;
  try {
    if (typeof createImageBitmap === "function") bmp = await createImageBitmap(file);
    else {
      url = URL.createObjectURL(file);
      bmp = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });
    }
    const width = bmp.width || bmp.naturalWidth, height = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, q.sample / Math.max(width, height)), w = Math.max(3, Math.round(width * k)), h = Math.max(3, Math.round(height * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    const stats = analyzeGray(rgbaToGray(ctx.getImageData(0, 0, w, h).data), w, h);
    return judgePhoto({ width, height, stats }, q);
  } catch (e) { return null; }
  finally { if (bmp && bmp.close) try { bmp.close(); } catch (e) { /* */ } if (url) URL.revokeObjectURL(url); }
}
