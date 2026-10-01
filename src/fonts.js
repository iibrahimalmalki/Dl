// الخطوط المضمّنة (مستضافة مع المنصة في public/) — مشتركة بين تقرير الجولة وبطاقة الأداء وبطاقة التكريم
// self-hosted embedded fonts — no system fonts or external services
const SITE=(typeof location!=="undefined"&&location.origin)||"https://db1-sandy.vercel.app";
export const FONT_BASE=(typeof globalThis!=="undefined"&&globalThis.__DW_FONT_BASE)||SITE;
export function fontFaces(base=FONT_BASE){
  const f=(fam,file,w,range)=>`@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:block;src:url(${base}/${file}) format('woff2');${range?`unicode-range:${range};`:""}}`;
  const AR="U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC";
  const BN="U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1";
  return[400,500,700].map(w=>f("IBM Plex Sans Arabic",`ibm-plex-sans-arabic-arabic-${w}-normal.woff2`,w,AR)+f("IBM Plex Sans Arabic",`ibm-plex-sans-arabic-latin-${w}-normal.woff2`,w,"")).join("")
    +[400,600].map(w=>f("Noto Sans Bengali",`noto-sans-bengali-bengali-${w}-normal.woff2`,w,BN)).join("");
}
export const FONT_STACK="'IBM Plex Sans Arabic','Noto Sans Bengali',Tahoma,sans-serif";
