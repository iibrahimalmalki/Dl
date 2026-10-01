// أدوات التصدير المشتركة: تحميل html2canvas/jsPDF من public/، الخطوط المضمّنة، تحويل قالب HTML إلى صورة/PDF
import{fontFaces,FONT_BASE}from"./fonts";

const loaded={};
export function loadScript(src){
  if(!loaded[src])loaded[src]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.async=true;s.onload=res;s.onerror=()=>{delete loaded[src];rej(new Error("تعذّر تحميل "+src));};document.head.appendChild(s);});
  return loaded[src];
}
export async function vendor(){
  await Promise.all([loadScript(FONT_BASE+"/html2canvas.min.js"),loadScript(FONT_BASE+"/jspdf.umd.min.js")]);
  return{html2canvas:window.html2canvas,jsPDF:window.jspdf&&window.jspdf.jsPDF};
}
let fontsReady=null;
export function ensureFonts(){
  if(!fontsReady){
    if(!document.getElementById("dw-embedded-fonts")){const st=document.createElement("style");st.id="dw-embedded-fonts";st.textContent=fontFaces();document.head.appendChild(st);}
    fontsReady=Promise.all(["400","700"].flatMap(w=>[document.fonts.load(`${w} 16px 'IBM Plex Sans Arabic'`,"أب"),document.fonts.load(`${w} 16px 'IBM Plex Sans Arabic'`,"Ab")])
      .concat([document.fonts.load("600 16px 'Noto Sans Bengali'","অআ")])).catch(()=>{});
  }
  return fontsReady;
}
const waitImages=(root,ms=6000)=>Promise.all([...root.querySelectorAll("img")].map(img=>img.complete&&img.naturalWidth?null:new Promise(r=>{const t=setTimeout(r,ms);img.onload=img.onerror=()=>{clearTimeout(t);r();};})));
// يرسم قالب HTML مستقلاً (عرض/ارتفاع ثابتان) خارج الشاشة ويعيد canvas
export async function renderHTML(html,{width,height,scale=2,background="#ffffff"}={}){
  const{html2canvas}=await vendor();await ensureFonts();
  const host=document.createElement("div");
  host.style.cssText=`position:fixed;left:-20000px;top:0;width:${width}px;${height?`height:${height}px;`:""}overflow:hidden;z-index:-1;pointer-events:none`;
  host.innerHTML=html;document.body.appendChild(host);
  try{
    await waitImages(host);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return await html2canvas(host.firstElementChild,{scale,useCORS:true,backgroundColor:background,width,height:height||host.firstElementChild.scrollHeight,windowWidth:width,logging:false});
  }finally{host.remove();}
}
export const canvasBlob=(c,type="image/png",q)=>new Promise(r=>c.toBlob(r,type,q));
export function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
// صفحة A4 واحدة (عمودي) من canvas
export async function canvasToPdfA4(canvas,name){
  const{jsPDF}=await vendor();
  const pdf=new jsPDF({unit:"mm",format:"a4",orientation:"portrait",compress:true});
  const W=210,H=297;const ratio=canvas.height/canvas.width;const h=Math.min(H,W*ratio);
  pdf.addImage(canvas.toDataURL("image/jpeg",0.92),"JPEG",0,0,h<H?W:H/ratio,h);
  pdf.save(name);
}
// مشاركة ملف عبر Web Share API إن أمكن، وإلا تنزيل
export async function shareOrDownload(blob,name,title){
  try{
    const file=new File([blob],name,{type:blob.type});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:title||name});return"shared";}
  }catch(e){if(e&&e.name==="AbortError")return"cancelled";}
  downloadBlob(blob,name);return"downloaded";
}
