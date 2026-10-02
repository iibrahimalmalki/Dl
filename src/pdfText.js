// استخراج أسطر النص من PDF في المتصفح بـ pdf.js — يُحمَّل عند الطلب فقط (import ديناميكي) والـ worker من الحزمة نفسها لا من CDN.
// السطر = عناصر الصفحة التي لها الإحداثي y نفسه (تسامح ±2) مرتبة حسب x ومفصولة بمسافة.
export async function pdfLines(file){
  const[pdfjs,worker]=await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"),import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  const lines=[];let chars=0;
  for(let p=1;p<=doc.numPages;p++){
    const page=await doc.getPage(p);const tc=await page.getTextContent();
    const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str,x:i.transform[4],y:i.transform[5]}));
    chars+=items.reduce((a,i)=>a+i.s.trim().length,0);
    items.sort((a,b)=>b.y-a.y||a.x-b.x);
    const rows=[];
    for(const it of items){const r=rows.find(r=>Math.abs(r.y-it.y)<=2);if(r)r.items.push(it);else rows.push({y:it.y,items:[it]});}
    rows.sort((a,b)=>b.y-a.y).forEach(r=>lines.push(r.items.sort((a,b)=>a.x-b.x).map(i=>i.s.trim()).join(" ")));
  }
  await doc.destroy();
  return{lines,chars,pages:doc.numPages};
}
