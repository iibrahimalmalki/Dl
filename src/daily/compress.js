// ضغط صورة في المتصفح قبل الرفع — مشترك بين الاستلام اليومي ونموذج تسليم الدراجة (يُستورد كسولاً)
// أطول ضلع 1600px، JPEG جودة 0.8
export async function compressImage(file, max = 1600, q = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("تعذّر قراءة الصورة")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok, bad) => c.toBlob(b => b ? ok(b) : bad(new Error("تعذّر ضغط الصورة")), "image/jpeg", q));
  } finally { URL.revokeObjectURL(url); }
}
