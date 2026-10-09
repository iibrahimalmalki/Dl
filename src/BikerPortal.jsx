import React, { Suspense, lazy, useEffect, useState } from "react";
import { supabase } from "./supabase";
import TOOLREFS from "./toolRefs";
import { ThemeToggle, Orbs, useToast } from "./ui";
import { daysLeft, docStatus, docBn, dayText, dayTextBn, pickContact } from "./renewalsLib";
import { bikerScore, nextHints } from "./scorecard";
import { dailySVG } from "./perfCharts";
import ChartTip from "./ChartTip";
import GlassSidebar from "./GlassSidebar";
import BottomNav from "./BottomNav";
import { useTheme } from "./theme";
import { humanError, normalizeId, adminWaLink, ADMIN_WA } from "./errors";
import { idToEmail } from "./bikerLogin";
import { KitStyle, Btn, ErrorNote, FieldErr, UploadBar, Skel, StickyBar, NetBar, OfflineHint, useOnline, useConfirm, useKeyboardOpen, loadDraft, saveDraft, Bn } from "./uiKit";
import { resolveTabs } from "./bikerTabs";
import { loadTabRules } from "./bikerTabsStore";
import { CHECKLIST, RECEIVED_ITEMS, BOX_PHOTOS, emptyReceived, receivedRecord, itemsOk, HANDOVER_STEPS, stepError, firstStepError, stepMove, stepSkipped, boxNeeded, odoNum, MAX_DAMAGES, DAMAGE_PARTS, DAMAGE_TYPES, emptyDamage, damagePart, damageType, damagePhotosFlat } from "./handover";
import { checkPhoto } from "./photoQuality";
import { STATES as H_STATES, handoverState, fixInfo, latestRow } from "./handoverStatus";
// الأكاديمية وصورها تُحمَّل عند فتح تبويبها فقط
const Academy = lazy(() => import("./academy/Academy"));
const DailyReceive = lazy(() => import("./daily/DailyReceive"));
const SupportBiker = lazy(() => import("./launch/SupportBiker"));
const MySteps = lazy(() => import("./launch/MySteps"));
const HandoverReport = lazy(() => import("./HandoverReport"));

/*  بوابة البايكر — دلو ورغوة | বাইকার পোর্টাল
    هوية دلو ورغوة (برتقالي) · ثنائية اللغة (عربي + বাংলা)
    شاشات: ملفي · تسليم/استلام الدراجة (٤ اتجاهات + عداد + أضرار + قائمة تحقق) · سجل الوقود (فاتورة إلزامية)
    كل بايكر يرى دراجته المخصّصة وسجلاته فقط (RLS via biker_employee_id).
    الصور تُرفع إلى مخزن field-evidence (عام).
*/

const CSS = `
.bp-wrap{font-family:var(--font);direction:rtl;background:var(--bg);min-height:100dvh;color:var(--ink);padding:66px 10px 70px;position:relative}
.bp-wrap:not(.bp-shell)>*:not(.g-orbs):not(.g-corner){position:relative;z-index:1}
/* ── هيكل البوابة: شريط علوي + قائمة جانبية (≥1024) أو درج + شريط سفلي (≤640) — نفس GlassSidebar و g-bnav في النظام الرئيسي ── */
.bp-shell{padding:0;display:flex;align-items:flex-start}
.bp-main{flex:1;min-width:0;min-height:100dvh;display:flex;flex-direction:column;position:relative;z-index:1}
.bp-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:10px;padding:8px 14px;padding-top:max(8px,env(safe-area-inset-top));background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border-bottom:1px solid var(--line)}
.bp-brand{flex:1;min-width:0;display:flex;align-items:center;gap:9px}
.bp-brand>div{min-width:0;line-height:1.3}
.bp-brand b{display:block;font-size:14.5px;font-weight:900;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-brand .bn{display:block;font-size:10.5px;font-weight:600;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-mark{width:34px;height:34px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 4px 12px rgba(232,113,43,.3)}
.bp-mark img{width:24px;height:24px;object-fit:contain}
.bp-who{display:flex;flex-direction:column;align-items:flex-end;line-height:1.25;min-width:0;max-width:34vw}
.bp-who b{font-size:12.5px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.bp-num{font-size:11px;color:var(--mut);font-weight:700;direction:ltr;unicode-bidi:isolate}
.bp-burger{display:none;width:40px;height:40px;border-radius:11px;border:1px solid var(--line-2);background:var(--glass-2);color:var(--ink);font-size:18px;cursor:pointer;flex:none}
.bp-burger:focus-visible{outline:none;box-shadow:var(--glow)}
.bp-content{padding:14px 10px 28px;width:100%;max-width:720px;margin:0 auto}
@media(min-width:641px) and (max-width:1023px){.bp-burger{display:block}}
@media(max-width:640px){
  .bp-content{padding-bottom:calc(var(--bnav-h) + env(safe-area-inset-bottom) + 24px)}
  .bp-who{max-width:28vw}
}
.bp-wrap .g-bnav-i{gap:1px}
.bp-wrap .g-bnav-bn{font-size:9px;font-weight:600;line-height:1.1;color:inherit;opacity:.8;font-family:system-ui,-apple-system,'Noto Sans Bengali','Segoe UI',sans-serif}
/* حقول الإدخال لا تتجاوز بطاقتها (Safari يفرض عرضاً داخلياً لحقول التاريخ والوقت) */
.bp-wrap input,.bp-wrap select,.bp-wrap textarea{max-width:100%;min-width:0;box-sizing:border-box}
.bp-wrap input[type=date],.bp-wrap input[type=time],.bp-wrap input[type=datetime-local]{width:100%;-webkit-appearance:none;appearance:none;min-height:48px}
.bp-wrap .bn,.bp-wrap :lang(bn){font-family:system-ui,-apple-system,'Noto Sans Bengali','Segoe UI',sans-serif}
.bp-card{max-width:560px;margin:0 auto 14px;border-radius:18px;overflow:hidden}
.bp-head{background:linear-gradient(135deg,var(--a),var(--p));color:#fff;padding:18px 18px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.bp-head h1{font-size:19px;font-weight:900;margin:0}
.bp-head .s{font-size:12.5px;font-weight:600;margin-top:4px;line-height:1.5}
.bp-logout{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:11px;padding:7px 14px;min-height:44px;min-width:44px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;flex-shrink:0;line-height:1.4}
.bp-prof{max-width:560px;margin:0 auto 14px;display:flex;gap:10px}
.bp-pcell{flex:1;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:14px;padding:12px 10px;text-align:center;box-shadow:var(--shadow)}
.bp-pcell .k{font-size:10.5px;color:var(--mut);font-weight:700}
.bp-pcell .v{font-size:15px;font-weight:900;color:var(--ink);margin-top:3px}
.bp-tabs{display:flex;gap:6px;max-width:560px;margin:0 auto 14px;padding:5px;border-radius:16px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);box-shadow:var(--shadow)}
.bp-tab{flex:1;min-height:48px;padding:8px 4px;text-align:center;border-radius:12px;background:transparent;border:1px solid transparent;font-weight:800;font-size:12.5px;cursor:pointer;color:var(--mut);line-height:1.45;font-family:inherit}
.bp-tab .bn{display:block;font-size:10px;font-weight:600}
.bp-tab.on{background:linear-gradient(135deg,var(--a),var(--p));color:#fff;box-shadow:0 6px 16px -8px rgba(var(--p-rgb),.8)}
.bp-tab:focus-visible,.bp-seg button:focus-visible,.bp-btn:focus-visible,.bp-logout:focus-visible{outline:none;box-shadow:var(--glow)}
.bp-sec{padding:16px 18px}
.bp-lbl{font-size:13px;font-weight:800;color:var(--ink-2);margin:14px 0 6px;display:block}
.bp-lbl .bn{font-weight:600;color:var(--mut);font-size:11px}
.bp-req{color:var(--bad-ink);font-weight:900}
.bp-in,.bp-sel,.bp-ta{min-height:46px;padding:11px 13px;font-size:15px}
.bp-ta{min-height:72px;resize:vertical}
.bp-bike{display:flex;align-items:center;gap:10px;background:var(--p-50);border:1px solid rgba(var(--p-rgb),.35);border-radius:12px;padding:12px 14px}
.bp-bike .ic{font-size:24px}
.bp-bike .p{font-weight:900;font-size:16px;color:var(--p-700)}
.bp-bike .m{font-size:11.5px;color:var(--mut)}
:root[data-theme=dark] .bp-bike .p{color:var(--p)}
.bp-row{display:flex;gap:10px}.bp-row>*{flex:1}
.bp-seg{display:flex;gap:8px}
.bp-seg button{flex:1;min-height:48px;padding:9px 6px;border-radius:11px;border:1px solid var(--line-2);background:var(--glass-2);font-weight:800;font-size:13px;cursor:pointer;color:var(--mut);font-family:inherit;line-height:1.4}
.bp-seg button .bn{display:block;font-size:10.5px;font-weight:600}
.bp-seg button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.bp-chklist{border:1px solid var(--line-2);border-radius:12px;overflow:hidden;margin-top:6px}
.bp-chk{display:flex;align-items:center;gap:10px;min-height:48px;box-sizing:border-box;padding:11px 13px;font-size:13.5px;font-weight:700;color:var(--ink-2);border-bottom:1px solid var(--line);background:var(--glass-2)}
.bp-chk:last-child{border-bottom:none}
.bp-chk input{width:22px;height:22px;accent-color:var(--ok);flex-shrink:0}
.bp-chk .bn{font-weight:600;color:var(--mut);font-size:11px}
.bp-chk .tx{flex:1}
.bp-chk.pledge{margin-top:14px;background:var(--p-50);border:1px solid rgba(var(--p-rgb),.35);border-radius:12px;padding:12px 13px;align-items:flex-start}
.bp-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:6px}
.bp-pbox{border:1.5px dashed rgba(var(--p-rgb),.5);border-radius:12px;background:var(--p-50);overflow:hidden;position:relative;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;text-align:center}
.bp-pbox input{display:none}
.bp-pbox .cap{font-size:12px;font-weight:800;color:var(--p-700);padding:6px}
.bp-pbox .cap .bn{display:block;font-size:10px;font-weight:600;color:var(--mut)}
:root[data-theme=dark] .bp-pbox .cap,:root[data-theme=dark] .bp-photo label,:root[data-theme=dark] .bp-acap{color:var(--p)}
.bp-pbox .em{font-size:22px;margin-top:6px}
.bp-pbox.done{border-style:solid;border-color:var(--ok)}
.bp-pbox img{width:100%;height:96px;object-fit:cover;display:block}
.bp-pbox .tag{position:absolute;top:5px;inset-inline-start:5px;background:rgba(10,14,39,.75);color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px}
.bp-photo{margin-top:6px}
.bp-pbox.chk{opacity:.6;pointer-events:none}
.bp-pbox .chkm{position:absolute;inset:auto 0 0 0;background:rgba(10,14,39,.75);color:#fff;font-size:10.5px;font-weight:800;padding:3px}
.bp-dmg{border:1px solid var(--line-2);border-radius:14px;padding:12px;margin-top:10px;background:var(--glass-2)}
.bp-dmg-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:900;font-size:14px;color:var(--ink)}
.bp-dmg-h button{min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--bad) 40%,transparent);background:none;color:var(--bad-ink);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.bp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.bp-chips button{min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid var(--line-2);background:var(--glass-2);font:inherit;font-weight:800;font-size:12.5px;color:var(--mut);cursor:pointer;line-height:1.3}
.bp-chips button .bn{display:block;font-size:10px;font-weight:600}
.bp-chips button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.bp-photo input{display:none}
.bp-photo label{display:inline-flex;align-items:center;gap:7px;min-height:46px;box-sizing:border-box;padding:11px 15px;background:var(--p-50);border:1.5px dashed rgba(var(--p-rgb),.5);border-radius:11px;color:var(--p-700);font-weight:800;font-size:13px;cursor:pointer}
.bp-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.bp-thumbs img{width:66px;height:66px;object-fit:cover;border-radius:10px;border:1px solid var(--line-2)}
.bp-btn{width:100%;min-height:50px;margin-top:18px;padding:14px;background:linear-gradient(135deg,var(--a),var(--p));color:#fff;border:none;border-radius:12px;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;box-shadow:0 8px 20px -10px rgba(var(--p-rgb),.9)}
.bp-btn:disabled{opacity:.6}
.bp-msg{margin-top:12px;padding:11px 13px;border-radius:11px;font-size:13px;font-weight:700}
.bp-ok{background:var(--ok-bg);color:var(--ok-ink)}.bp-err{background:var(--bad-bg);color:var(--bad-ink)}
.bp-list{margin-top:6px}
.bp-item{border:1px solid var(--line);border-radius:11px;padding:10px 12px;margin-bottom:7px;font-size:12.5px;background:var(--glass-2)}
.bp-item .t{font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;flex-wrap:wrap}.bp-item .m{color:var(--mut);font-size:11.5px;margin-top:2px}
.bp-item .t .g-badge{margin-inline-start:auto}
.bp-note{font-size:11.5px;color:var(--mut);margin-top:6px;line-height:1.6}
.bp-logo{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,var(--a),var(--p));display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:30px;box-shadow:0 8px 20px rgba(var(--p-rgb),.32);overflow:hidden}
.bp-logo img{width:70%;height:70%;object-fit:contain}
.bp-aitem{border-bottom:1px solid var(--line);background:var(--glass-2)}.bp-aitem:last-child{border-bottom:none}
.bp-aitem.on{background:var(--p-50)}
.bp-arow{display:flex;align-items:center;gap:10px;min-height:48px;padding:10px 13px;cursor:pointer}
.bp-arow input[type=checkbox]{width:22px;height:22px;accent-color:var(--ok);flex:none}
.bp-arow .tx{flex:1;font-size:13.5px;font-weight:700;color:var(--ink-2)}
.bp-arow .tx .bn{font-weight:600;color:var(--mut);font-size:11px}
.bp-aref{width:46px;height:46px;border-radius:10px;object-fit:cover;border:1px solid var(--line-2);flex:none;background:#fff}
.bp-aref.ph{display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--mut-2);background:var(--soft)}
.bp-acap{display:inline-flex;align-items:center;gap:8px;min-height:44px;box-sizing:border-box;padding:9px 13px;background:var(--p-50);border:1.5px dashed rgba(var(--p-rgb),.5);border-radius:11px;color:var(--p-700);font-weight:800;font-size:12.5px;cursor:pointer}
.bp-acap input{display:none}
.bp-athumb{width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--line-2)}
.bp-done{color:var(--ok-ink)}
.bp-pf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.bp-pf-grid div{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:9px 4px;text-align:center}
.bp-pf-grid b{display:block;font-size:19px;font-weight:900;color:var(--ink)}.bp-pf-grid b.o{color:var(--p-ink)}
.bp-pf-grid span{font-size:10.5px;color:var(--mut);font-weight:700}.bp-pf-grid .bn,.bp-pf-row .bn,.bp-pf-total .bn{font-size:inherit}
.bp-pf-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.bp-pf-total{display:flex;justify-content:space-between;align-items:center;background:var(--p-50);border:1px solid rgba(var(--p-rgb),.3);border-radius:12px;padding:10px 13px;font-size:12.5px;font-weight:700;color:var(--ink-2)}
.bp-pf-total b{font-size:18px;color:var(--p-ink)}
.bp-pf-chart{margin-top:12px;overflow:hidden}
.bp-pf-next{margin-top:12px;font-size:12.5px;line-height:1.7;color:var(--ink-2);border:1px dashed rgba(var(--p-rgb),.45);border-radius:12px;padding:10px 12px}
.bp-pf-next b{display:block;color:var(--p-ink);margin-bottom:2px}.bp-pf-next .bn{color:var(--mut);font-size:11.5px}
.bp-tabs{overflow-x:auto;scrollbar-width:none}.bp-tabs::-webkit-scrollbar{display:none}.bp-tab{min-width:62px}
@media(max-width:400px){.bp-pf-grid{grid-template-columns:1fr 1fr}}
.bp-doc{border:1px solid var(--line);border-radius:14px;padding:12px 13px;margin-bottom:9px;background:var(--glass-2)}
.bp-doc-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px}
.bp-doc-h .t{font-weight:900;font-size:15px;color:var(--ink)}.bp-doc-h .bn{font-size:12px;color:var(--mut);font-weight:600}
.bp-dbadge{flex-direction:column;gap:1px;border-radius:12px;padding:5px 11px;flex:none;line-height:1.3}
.bp-dbadge b{font-weight:800}.bp-doc-h .bp-dbadge .bn{color:inherit;font-size:11px;font-weight:600}
.bp-doc .m{font-size:12.5px;color:var(--mut)}.bp-doc .m b{color:var(--ink);direction:ltr;unicode-bidi:isolate}
.bp-btn.bp-call{margin-top:10px;min-height:46px;padding:11px;font-size:14px}
.bp-btn.bp-wa{background:linear-gradient(135deg,#128C7E,#075E54);box-shadow:0 8px 20px -10px rgba(7,94,84,.9)}
.bp-btn.bp-wa small{display:block;font-size:11.5px;font-weight:700;margin-top:2px}
.bp-rcv{padding:11px 13px;border-bottom:1px solid var(--line);background:var(--glass-2)}.bp-rcv:last-child{border-bottom:none}
.bp-rcv-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.bp-rcv-h .tx{flex:1;min-width:120px;font-size:13.5px;font-weight:700;color:var(--ink-2)}.bp-rcv-h .bn{font-weight:600;color:var(--mut);font-size:11px}
.bp-yn{flex:none;width:150px}.bp-yn button{min-height:46px}
.bp-yn:has(button:nth-child(3)){width:100%}.bp-yn button.on.note{background:var(--warn);border-color:var(--warn);color:#fff}
.bp-cknote{display:block;width:100%;margin-top:6px;min-height:40px;padding:8px 10px;font-size:14px}
.bp-item-open{cursor:pointer}.bp-item-open:hover{border-color:rgba(var(--p-rgb),.4)}
.bp-open{margin-inline-start:auto;font-size:11.5px;font-weight:800;color:var(--p-ink)}.bp-open .bn{display:inline;font-size:10.5px}
.bp-yn button.on.yes{background:var(--ok);border-color:var(--ok);color:#fff}.bp-yn button.on.no{background:var(--bad);border-color:var(--bad);color:#fff}
.bp-rcv-n{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:12.5px;font-weight:700;color:var(--ink-2)}.bp-rcv-n .bp-seg{flex:1}.bp-rcv-n .bp-seg button{min-height:44px}
.bp-mks{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
.bp-mk{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--soft);color:var(--mut)}.bp-mk.ok{background:var(--ok-bg);color:var(--ok-ink)}.bp-mk.bad{background:var(--bad-bg);color:var(--bad-ink)}
.bp-pw{position:relative}.bp-pw input{padding-left:84px!important}
.bp-eye{position:absolute;top:50%;transform:translateY(-50%);left:4px;min-width:72px;min-height:44px;border:none;background:transparent;color:var(--p-ink);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;line-height:1.2;border-radius:10px}
.bp-eye .bn{display:block;font-size:10.5px;font-weight:600}
.bp-eye:focus-visible{outline:none;box-shadow:var(--glow)}
.bp-stack{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.bp-start{border:2px solid rgba(var(--p-rgb),.45)}
.bp-eyebrow{font-size:11.5px;font-weight:800;color:var(--p-ink);letter-spacing:.2px}
.bp-start-t{display:flex;align-items:center;gap:10px;margin-top:6px}.bp-start-t>span{font-size:28px}.bp-start-t b{display:block;font-size:17px;font-weight:900;color:var(--ink)}.bp-start-t .bn{display:block;font-size:12.5px;color:var(--mut);font-weight:600}
.bp-free{overflow:visible}
.bp-wiz-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px}
.bp-wiz-top .g-btn{min-height:44px;padding:6px 14px}
.bp-wiz-n{font-size:13px;font-weight:900;color:var(--mut);direction:ltr;unicode-bidi:isolate}
.bp-dots{display:flex;gap:5px;justify-content:center;margin:8px 0 4px}.bp-dots i{width:8px;height:8px;border-radius:50%;background:var(--line-2)}.bp-dots i.done{background:var(--ok)}.bp-dots i.now{background:var(--p);width:20px;border-radius:6px}
.bp-wiz-h{font-size:19px;font-weight:900;margin:8px 0 10px;color:var(--ink);line-height:1.4}.bp-wiz-h .bn{display:block;font-size:13.5px;font-weight:600;color:var(--mut)}
.bp-ck2{padding:10px 12px;border-bottom:1px solid var(--line);background:var(--glass-2)}.bp-ck2:last-child{border-bottom:none}
.bp-ck2-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:48px}
.bp-ck2-h .tx{flex:1;min-width:130px;font-size:14px;font-weight:800;color:var(--ink-2);line-height:1.4}.bp-ck2-h .tx .bn{display:block;font-size:11.5px;font-weight:600;color:var(--mut)}
.bp-ok2{display:flex;gap:6px;flex:none}
.bp-ok2 button{min-width:84px;min-height:48px;padding:6px 8px;border-radius:11px;border:1px solid var(--line-2);background:var(--glass-3);color:var(--ink-2);font:inherit;font-size:13px;font-weight:800;cursor:pointer;line-height:1.3}
.bp-ok2 button .bn{display:block;font-size:10.5px;font-weight:600}
.bp-ok2 button.on.yes{background:var(--ok);border-color:var(--ok);color:#fff}.bp-ok2 button.on.no{background:var(--bad);border-color:var(--bad);color:#fff}
.bp-ok2 button:focus-visible{outline:none;box-shadow:var(--glow)}
.bp-rev{border:1px solid var(--line-2);border-radius:12px;overflow:hidden}
.bp-rev-r{display:grid;grid-template-columns:minmax(0,38%) minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--line);font-size:13px;min-height:48px}.bp-rev-r:last-child{border-bottom:none}
.bp-rev-r .l{color:var(--mut);font-weight:700}.bp-rev-r b{color:var(--ink);overflow-wrap:anywhere}
.bp-rev-r .g-btn{min-height:44px;padding:4px 10px;font-size:13px}
.bp-chk.pledge{min-height:48px;cursor:pointer}.bp-chk.pledge input{width:26px;height:26px;margin-top:2px}
.bp-thumb{position:relative;display:inline-block}.bp-thumb button{position:absolute;top:-6px;inset-inline-start:-6px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(10,14,39,.78);color:#fff;font-size:16px;cursor:pointer;line-height:1}
.bp-thumb button::after{content:"";position:absolute;inset:-8px}
.bp-ntf.un{border-color:rgba(var(--p-rgb),.45);background:var(--p-50)}
`;

/* قائمة التحقق الأساسية للدراجة (أفضل الممارسات) */
/* خلفية الكرات + زر الثيم في الزاوية — مرة واحدة في جذر كل شاشة */
// تنقّل البوابة: القائمة الجانبية/«المزيد» والشريط السفلي للجوال («الرئيسية» + حتى ثلاثة + المزيد)
// يحدّدها المالك من «صلاحيات البايكرز» (biker_tab_rules ← src/bikerTabs.js)؛ قبل الجدول أو بلا صفوف ⇒ كل التبويبات كما كانت
const Chrome = () => <><Orbs /><div className="g-corner"><ThemeToggle /></div></>;


/* عناصر العهدة (الأدوات والمواد) — مطابقة لملف الأدوات، مع صورة مرجعية لكل صنف */
const ASSET_ITEMS = [
  // السلامة والملابس
  { key: "uniform", ar: "الزي (ملابس العمل)", bn: "ইউনিফর্ম", img: null },
  { key: "helmet", ar: "الخوذة", bn: "হেলমেট", img: "helmet" },
  { key: "safety_chest", ar: "واقي الصدر", bn: "বুকের সুরক্ষা", img: "safety_chest" },
  { key: "safety_limbs", ar: "واقيات اليدين والساقين", bn: "হাত ও পায়ের সুরক্ষা", img: "safety_limbs" },
  { key: "shoes", ar: "حذاء السلامة", bn: "নিরাপত্তা জুতা", img: "shoes" },
  { key: "headlight", ar: "كشّاف الرأس", bn: "হেডলাইট", img: "headlight" },
  // نظام الماء
  { key: "water_tank", ar: "خزان الماء", bn: "পানির ট্যাংক", img: null },
  { key: "water_motor", ar: "موتور/مضخة الماء", bn: "ওয়াটার মোটর", img: "water_motor" },
  { key: "water_gun", ar: "مسدس الماء", bn: "ওয়াটার গান", img: "water_gun" },
  // الفرش
  { key: "floor_brush", ar: "فرشاة الأرضية", bn: "ফ্লোর ব্রাশ", img: "floor_brush" },
  { key: "tyre_brush", ar: "فرشاة الإطارات", bn: "টায়ার ব্রাশ", img: "tyre_brush" },
  { key: "small_brush", ar: "فرشاة صغيرة", bn: "ছোট ব্রাশ", img: "small_brush" },
  { key: "ac_brush", ar: "فرشاة المكيّف", bn: "এসি ব্রাশ", img: "ac_brush" },
  // الإسفنج
  { key: "sponge_body", ar: "إسفنجة البودي", bn: "বডি স্পঞ্জ", img: "sponge_body" },
  { key: "sponge_tyre", ar: "إسفنجة الإطارات", bn: "টায়ার স্পঞ্জ", img: "sponge_tyre" },
  // المكنسة
  { key: "vacuum", ar: "المكنسة الكهربائية", bn: "ভ্যাকুয়াম ক্লিনার", img: "vacuum" },
  // مواد التنظيف والتلميع
  { key: "dashboard_polish", ar: "ملمّع التابلوه", bn: "ড্যাশবোর্ড পলিশ", img: "dashboard_polish" },
  { key: "tyre_polish", ar: "ملمّع الإطارات", bn: "টায়ার পলিশ", img: "tyre_polish" },
  { key: "stain_remover", ar: "مزيل البقع", bn: "স্টেন রিমুভার", img: "stain_remover" },
  { key: "last_touch", ar: "اللمسة الأخيرة", bn: "লাস্ট টাচ", img: "last_touch" },
  { key: "glass_cleaner", ar: "منظّف الزجاج", bn: "গ্লাস ক্লিনার", img: "glass_cleaner" },
  // إضافات
  { key: "service_box", ar: "صندوق الخدمة الإضافي", bn: "সার্ভিস বক্স", img: "service_box" },
  { key: "soap_bottle", ar: "عبوة الصابون الفارغة", bn: "সাবানের বোতল", img: "soap_bottle" },
];
const CONDITIONS = [
  { v: "good", ar: "جيدة", bn: "ভালো" },
  { v: "fair", ar: "متوسطة", bn: "মাঝারি" },
  { v: "damaged", ar: "تالفة", bn: "ক্ষতিগ্রস্ত" },
];

/* ---------- شاشة الدخول ---------- */
function Login() {
  const [bid, setBid] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState(null);   // خطأ تحقق بجانب الحقل
  const [err, setErr] = useState(null); // humanError
  async function go() {
    setErr(null); setFe(null);
    const id = normalizeId(bid), p = normalizeId(pw); // بلا مسافات، وبأرقام لاتينية
    if (!id) { setFe({ f: "bid", ar: "اكتب رقم البايكر أو اسم المستخدم.", bn: "বাইকার নম্বর বা ইউজারনেম লিখুন।" }); return; }
    if (!p) { setFe({ f: "pw", ar: "اكتب كلمة المرور.", bn: "পাসওয়ার্ড লিখুন।" }); return; }
    setBid(id); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: idToEmail(id), password: p });
      if (error) setErr(humanError(error));
    } catch (e) { setErr(humanError(e)); }
    setBusy(false);
  }
  const online = useOnline();
  return (
    <div className="bp-wrap"><style>{CSS}</style><KitStyle /><Chrome /><NetBar />
      <div className="bp-card g-card" style={{ maxWidth: 380, marginTop: "8vh" }}>
        <form className="bp-sec" style={{ textAlign: "center", padding: "30px 24px" }} onSubmit={e => { e.preventDefault(); go(); }} noValidate>
          <div className="bp-logo">
            <img src="/brand-mark.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentNode.append("🪣"); }} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", margin: 0 }}>بوابة البايكر</h1>
          <div className="bn" style={{ fontSize: 12.5, color: "var(--mut)", fontWeight: 700, marginTop: 2, marginBottom: 4 }}>বাইকার পোর্টাল — দলু ওয়ারঘওয়া</div>

          <label className="bp-lbl" style={{ textAlign: "right" }} htmlFor="lg_id">رقم البايكر أو اسم المستخدم <span className="bn" style={{ display: "block" }}>বাইকার নম্বর বা ইউজারনেম</span></label>
          <input id="lg_id" className={"g-input bp-in" + (fe && fe.f === "bid" ? " k-inv" : "")} inputMode="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
            value={bid} onChange={e => setBid(e.target.value)} onBlur={() => setBid(v => normalizeId(v))} placeholder="1624 أو abed" aria-describedby="lg_id_e" dir="ltr" style={{ textAlign: "right" }} />
          {fe && fe.f === "bid" && <FieldErr id="lg_id_e" t={fe} />}
          <label className="bp-lbl" style={{ textAlign: "right" }} htmlFor="lg_pw">كلمة المرور <span className="bn" style={{ display: "block" }}>পাসওয়ার্ড</span></label>
          <div className="bp-pw">
            <input id="lg_pw" className={"g-input bp-in" + (fe && fe.f === "pw" ? " k-inv" : "")} type={show ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off"
              value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••" aria-describedby="lg_pw_e" dir="ltr" />
            <button type="button" className="bp-eye" onClick={() => setShow(v => !v)} aria-pressed={show} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{show ? "إخفاء" : "إظهار"}<span className="bn">{show ? "লুকান" : "দেখান"}</span></button>
          </div>
          {fe && fe.f === "pw" && <FieldErr id="lg_pw_e" t={fe} />}
          <Btn type="submit" kind="primary" block big busy={busy} disabled={!online} style={{ marginTop: 18 }} bn={busy ? "লগইন হচ্ছে…" : "প্রবেশ"}>{busy ? "جارٍ الدخول…" : "دخول"}</Btn>
          {!online && <OfflineHint />}
          {err && <div style={{ marginTop: 12, textAlign: "right" }}><ErrorNote e={err} onRetry={go} /></div>}
          {!err && <a className="g-btn k-btn ghost block" style={{ marginTop: 10 }} href={adminWaLink("LOGIN-HELP")} target="_blank" rel="noopener noreferrer">نسيت كلمة المرور؟ تواصل مع الإدارة<span className="k-bn">পাসওয়ার্ড ভুলে গেছেন? ম্যানেজমেন্টকে লিখুন</span></a>}
        </form>
      </div>
    </div>
  );
}

export default function BikerPortal() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);
  if (session === undefined) return <div className="bp-wrap"><style>{CSS}</style><KitStyle /><Chrome /><Skel /></div>;
  if (!session) return <Login />;
  return <Portal />;
}

function Portal() {
  const [me, setMe] = useState(null);
  const [myBike, setMyBike] = useState(null);
  const [temp, setTemp] = useState(false);   // حائز مؤقت (بديل)
  const [tab, setTab] = useState("profile");
  const [open, setOpen] = useState(false);           // قائمة «المزيد» / الدرج
  const [opName, setOpName] = useState("دلو ورغوة");  // اسم المشغّل (operators.name)
  const [pending, setPending] = useState(0);         // أنصبة الاستلام بانتظار تأكيدي
  // صلاحيات التبويبات (إعداد عام من المالك). حتى تصل أو إن فشلت قراءتها ⇒ مقفلة: «ملفي» و«الدعم» فقط
  const [tabRules, setTabRules] = useState({ rows: [], locked: true });
  const [tabsTry, setTabsTry] = useState(0);
  useEffect(() => { let on = true; loadTabRules().then(r => { if (on) setTabRules({ rows: r.rules || [], locked: !!(r.error || r.missing) }); }, () => {}); return () => { on = false; }; }, [tabsTry]);
  const TABS = React.useMemo(() => resolveTabs(tabRules.rows, { locked: tabRules.locked }), [tabRules]);
  const lastTab = React.useRef(null);                // الشاشة التي فُتح منها «الدعم» (تُحفظ مع الطلب)
  const dirty = React.useRef(false);                 // نموذج فيه مدخلات (تسليم الدراجة / استلام المندوب)
  const { resolved: theme } = useTheme();
  // شارة «الاستلام»: أنصبة بانتظار تأكيدي (يتجاهل الخطأ قبل/بدون جداول الاستلام)
  useEffect(() => { if (!me || !me.emp_id) return;
    supabase.from("daily_shares").select("id", { count: "exact", head: true }).eq("employee_id", me.emp_id).eq("status", "pending")
      .then(({ count, error }) => { if (!error) setPending(count || 0); }, () => {}); }, [me, tab]);
  const [err, setErr] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dlg, ask] = useConfirm();
  useKeyboardOpen();

  useEffect(() => { (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr(humanError({ status: 401, message: "session missing" })); return; }
      const { data: au } = await supabase.from("app_users")
        .select("biker_employee_id,display_name,operator_id,position").eq("id", user.id).single();
      if (!au || !au.biker_employee_id) { setErr({ key: "nolink", code: "E-LINK", action: "whatsapp", ar: "هذا الحساب غير مرتبط برقم بايكر، فلا يمكن فتح البوابة. تواصل مع الإدارة لربطه.", bn: "এই অ্যাকাউন্ট কোনো বাইকার নম্বরের সাথে যুক্ত নয়। ম্যানেজমেন্টকে জানান।" }); return; }
      const m = { uid: user.id, biker_employee_id: au.biker_employee_id, name: au.display_name, operator_id: au.operator_id };
      // ربط رقم البايكر بمعرّف الموظف (uuid) المستخدم في الأسطول
      const { data: emp } = await supabase.from("employees").select("id,full_name").eq("employee_id", au.biker_employee_id).maybeSingle();
      const empId = emp ? emp.id : null;
      m.emp_id = empId;
      setMe(m);
      // اسم المشغّل: سياسة operators_self_select تسمح للبايكر بقراءة مشغّله (my_operator() = app_users.operator_id)
      if (au.operator_id) supabase.from("operators").select("name").eq("id", au.operator_id).maybeSingle().then(({ data }) => { if (data && data.name) setOpName(data.name); }, () => {});
      if (empId) {
        // الدراجة التي يحوزها هذا البايكر حالياً: إمّا حائز مؤقت، أو مخصّصة له ولا يحوزها أحد مؤقتاً
        const { data: bk } = await supabase.from("fleet_vehicles")
          .select("id,plate,make,biker_employee_id,held_by,held_until,held_reason,needs_receipt_update")
          .eq("active", true)
          .or(`held_by.eq.${empId},and(held_by.is.null,biker_employee_id.eq.${empId})`).limit(1);
        const b = bk && bk[0] ? bk[0] : null;
        setMyBike(b);
        setTemp(!!(b && b.held_by === empId && b.biker_employee_id !== empId));
      }
    } catch (e) { setErr(humanError(e)); }
  })(); }, [reloadKey]);

  if (err) return <div className="bp-wrap"><style>{CSS}</style><KitStyle /><Chrome /><NetBar /><div className="bp-card g-card"><div className="bp-sec">
    <ErrorNote e={err} onRetry={() => { setErr(null); setReloadKey(x => x + 1); }} onLogin={() => supabase.auth.signOut()} />
    <Btn kind="text" block style={{ marginTop: 10 }} onClick={() => supabase.auth.signOut()} bn="লগআউট">خروج</Btn></div></div></div>;
  if (!me) return <div className="bp-wrap"><style>{CSS}</style><KitStyle /><Chrome /><NetBar /><Skel /></div>;

  // التنقّل: نموذج فيه صور غير محفوظة يطلب تأكيداً (باقي المدخلات محفوظة في المسودة)
  const go = async k => {
    if (!TABS.isOpen(k)) { setOpen(false); return; }
    if (k === tab) { setOpen(false); return; }
    if (dirty.current) {
      setOpen(false);
      const ok = await ask({ title: "مغادرة النموذج؟", titleBn: "ফর্ম ছেড়ে যাবেন?", ar: "الصور التي التقطتها ستضيع، أما باقي مدخلاتك فمحفوظة وتعود حين ترجع.", bn: "তোলা ছবিগুলো হারাবে, বাকি তথ্য সংরক্ষিত থাকবে।", ok: "مغادرة", okBn: "চলে যান", cancel: "البقاء", cancelBn: "থাকুন" });
      if (!ok) return;
    }
    dirty.current = false; lastTab.current = tab; setTab(k); setOpen(false); try { window.scrollTo(0, 0); } catch (e) { /* */ }
  };
  const badges = { handover: myBike && myBike.needs_receipt_update ? 1 : 0, daily: pending };
  const loading = <Skel />;
  const setDirty = v => { dirty.current = !!v; };
  const tempCard = temp && myBike && (
    <div className="bp-card g-card" style={{ marginBottom: 14 }}>
      <div className="bp-sec" style={{ padding: "12px 16px" }}>
        <div className="bp-msg bp-ok" style={{ margin: 0 }}>
          🔁 حيازة مؤقتة: دراجة {myBike.plate} بعهدتك حالياً كبديل{myBike.held_until ? ` حتى ${myBike.held_until}` : ""}.<br />
          <span className="bn">অস্থায়ী দায়িত্ব: বাইক {myBike.plate} বর্তমানে আপনার কাছে (বদলি)।</span>
        </div>
      </div>
    </div>);

  return (
    <div className="bp-wrap bp-shell">
      <style>{CSS}</style><KitStyle /><Orbs /><NetBar />{dlg}
      <GlassSidebar items={TABS.nav} active={tab} onGo={go} badges={badges} open={open} onOpenChange={setOpen} theme={theme} noSettings
        user={{ name: me.name, role: "بايكر · " + me.biker_employee_id }} onLogout={() => supabase.auth.signOut()}
        platform={{ name: opName, subtitle: "بوابة البايكر · বাইকার পোর্টাল" }} />
      <BottomNav items={TABS.bottom} active={tab} onGo={go} onMore={() => setOpen(true)} badges={badges} />

      <div className="bp-main">
        <header className="bp-top">
          <button type="button" className="bp-burger" onClick={() => setOpen(true)} aria-label="القائمة"><span aria-hidden="true">☰</span></button>
          <div className="bp-brand"><span className="bp-mark"><img src="/brand-mark.png" alt="" /></span>
            <div><b>{opName}</b><span className="bn">বাইকার পোর্টাল · Biker portal</span></div></div>
          <div className="bp-who"><b>{String(me.name || "").split(" ")[0] || "—"}</b><span className="bp-num">{me.biker_employee_id}</span></div>
          <ThemeToggle />
        </header>

        <div className="bp-content">
          {tab === "profile" && <>
            <div className="bp-card g-card">
              <div className="bp-head">
                <div>
                  <h1>بوابة البايكر</h1>
                  <div className="s">أهلاً {me.name} · স্বাগতম<br />رقمك · আপনার নম্বর: {me.biker_employee_id}</div>
                </div>
                <button className="bp-logout" onClick={() => supabase.auth.signOut()}>خروج<br />লগআউট</button>
              </div>
            </div>
            <div className="bp-prof">
              <div className="bp-pcell"><div className="k">الاسم · নাম</div><div className="v" style={{ fontSize: 13 }}>{me.name || "—"}</div></div>
              <div className="bp-pcell"><div className="k">رقم البايكر · নম্বর</div><div className="v">{me.biker_employee_id}</div></div>
              <div className="bp-pcell"><div className="k">دراجتي · আমার বাইক</div><div className="v" style={{ fontSize: 13 }}>{myBike ? myBike.plate : "—"}</div></div>
            </div>
            {tabRules.locked && <div className="bp-card g-card"><div className="bp-sec">
              <div className="bp-note" style={{ marginTop: 0 }}>بقية الصفحات تظهر بعد تحميل الإعداد. <span className="bn">সেটিংস লোড হলে বাকি পাতা দেখা যাবে।</span></div>
              <Btn kind="text" block onClick={() => setTabsTry(x => x + 1)} bn="আবার চেষ্টা করুন">إعادة المحاولة</Btn></div></div>}
            <StartHere me={me} myBike={myBike} pending={pending} onGo={go} can={TABS.isOpen} />
            <Suspense fallback={null}><MySteps me={me} /></Suspense>
            {tempCard}
            <Profile me={me} myBike={myBike} onGo={go} can={TABS.isOpen} />
          </>}
          {tab !== "profile" && !TABS.isOpen(tab) && <div className="bp-card g-card"><div className="bp-sec">
            <div className="g-empty" style={{ padding: "22px 10px" }}><b>غير متاح حالياً<span className="bn" style={{ display: "block" }}>বর্তমানে উপলব্ধ নয়</span></b></div>
            <Btn kind="primary" block onClick={() => setTab("profile")} bn="হোমে ফিরুন">العودة إلى الرئيسية</Btn></div></div>}
          {TABS.isOpen(tab) && tab === "handover" && <>{tempCard}<Handover me={me} myBike={myBike} onDirty={setDirty} /></>}
          {TABS.isOpen(tab) && tab === "fuel" && <Fuel me={me} myBike={myBike} />}
          {TABS.isOpen(tab) && tab === "assets" && <Assets me={me} />}
          {TABS.isOpen(tab) && tab === "docs" && <Docs me={me} />}
          {TABS.isOpen(tab) && tab === "perf" && <MyPerf me={me} />}
          {TABS.isOpen(tab) && tab === "daily" && <Suspense fallback={loading}><DailyReceive me={me} onDirty={setDirty} onPending={setPending} /></Suspense>}
          {TABS.isOpen(tab) && tab === "academy" && <Suspense fallback={loading}><Academy me={me} /></Suspense>}
          {tab === "support" && <Suspense fallback={loading}><SupportBiker me={me} from={lastTab.current} /></Suspense>}
        </div>
      </div>
    </div>
  );
}


/* ================= أدائي ================= */
const PM = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const PMB = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const pLabel = p => { const [y, m] = String(p).split("-"); return { ar: (PM[+m - 1] || m) + " " + y, bn: (PMB[+m - 1] || m) + " " + y }; };
const rt = v => v >= 0.75 ? "ok" : v >= 0.25 ? "warn" : "bad";
function MyPerf({ me }) {
  const [st, setSt] = useState({ loading: true });
  useEffect(() => { (async () => {
    const sid = String(me.biker_employee_id || "").trim();
    const denied = [];
    const run = async (t, q) => { try { const r = await q; if (r.error) { denied.push(t); return []; } return r.data || []; } catch (e) { denied.push(t); return []; } };
    // RLS: يُفترض أن تعيد صفوف هذا البايكر فقط؛ نقيّد بالرقم أيضاً
    const ops = await run("ops_biker_month", supabase.from("ops_biker_month").select("period,sweater_id,biker_name,net_washes,rating,approved_complaints,complaint_pct,daily").eq("sweater_id", sid).order("period", { ascending: false }).limit(2));
    const periods = ops.map(o => o.period);
    const [rounds, viol] = await Promise.all([
      run("field_rounds", supabase.from("field_rounds").select("round_date,compliance_pct,effect,status").eq("sweater_id", sid).order("round_date", { ascending: false }).limit(6)),
      periods.length ? run("violations", supabase.from("violations").select("period,status,fine_applied,code").eq("sweater_id", sid).in("period", periods).eq("status", "confirmed")) : [],
    ]);
    const scores = ops.map(o => bikerScore(o, { rounds: rounds.filter(r => String(r.round_date || "").slice(0, 7) <= o.period), violations: viol.filter(v => v.period === o.period) }));
    if (denied.length) console.warn("BikerPortal/أدائي — رُفضت القراءة من:", denied.join(", "));
    setSt({ loading: false, scores, denied });
  })(); }, [me.biker_employee_id]);
  if (st.loading) return <Skel rows={4} />;
  if (st.denied.includes("ops_biker_month")) return <div className="bp-card g-card"><div className="bp-sec"><div className="g-empty" style={{ padding: "22px 10px" }}><b>سيُفعَّل قريباً · <span className="bn">শীঘ্রই চালু হবে</span></b><p>صفحة أدائك قيد التفعيل. · আপনার কাজের পাতা শীঘ্রই চালু হবে।</p></div></div></div>;
  if (!st.scores.length) return <div className="bp-card g-card"><div className="bp-sec"><div className="g-empty" style={{ padding: "22px 10px" }}><b>لا بيانات أداء بعد · <span className="bn">এখনও কোনো তথ্য নেই</span></b><p>تظهر أرقامك بعد رفع تقرير سويتر الشهري. · মাসিক রিপোর্ট আপলোডের পর আপনার তথ্য দেখা যাবে।</p></div></div></div>;
  return (<>{st.scores.map((s, i) => { const L = pLabel(s.period); const hAr = nextHints(s, "ar"), hBn = nextHints(s, "bn"); return (
    <div className="bp-card g-card" key={s.period}><div className="bp-sec">
      <label className="bp-lbl" style={{ marginTop: 0 }}>{i === 0 ? "آخر شهر" : "الشهر الذي قبله"} · {L.ar} <span className="bn">/ {L.bn}</span></label>
      <div className="bp-pf-grid">
        <div><b>{s.washes}</b><span>غسلة · <span className="bn">ওয়াশ</span></span></div>
        <div><b>{s.rating ? s.rating.toFixed(2) : "—"}</b><span>التقييم · <span className="bn">রেটিং</span></span></div>
        <div><b>{s.complaintPct}%</b><span>الشكاوى · <span className="bn">অভিযোগ</span></span></div>
        <div><b className="o">{s.ratePerWash.toFixed(2)}</b><span>ريال/غسلة · <span className="bn">প্রতি ওয়াশ</span></span></div>
      </div>
      <div className="bp-pf-row">
        <span className={"g-badge " + rt(s.qR)}>الجودة · <span className="bn">কোয়ালিটি</span> {s.qR.toFixed(2)}</span>
        <span className={"g-badge " + rt(s.sR)}>السلامة · <span className="bn">সেফটি</span> {s.sR.toFixed(2)}</span>
        {s.production ? <span className="g-badge brand">مكافأة الإنتاج · <span className="bn">বোনাস</span> +{s.production}</span> : null}
      </div>
      <div className="bp-pf-total"><span>العمولة المتوقعة · <span className="bn">সম্ভাব্য কমিশন</span></span><b>{(s.bonusBase + s.production).toLocaleString("en-US", { maximumFractionDigits: 2 })} ﷼</b></div>
      {i === 0 && s.days.length > 0 && <div className="bp-pf-chart"><div className="bp-note" style={{ marginTop: 0 }}>غسلاتك اليومية · <span className="bn">দৈনিক ওয়াশ</span>{s.bestDay ? ` · أفضل يوم ${s.bestDay.date.slice(8)} (${s.bestDay.n})` : ""}</div>
        <ChartTip label="غسلاتك اليومية"><div dangerouslySetInnerHTML={{ __html: dailySVG(s.days, s.period, { height: 120, width: 520, avg: s.dailyAvg || null }) }} /></ChartTip></div>}
      {i === 0 && hAr.length > 0 && <div className="bp-pf-next"><b>هدفك التالي · <span className="bn">পরবর্তী লক্ষ্য</span></b>{hAr.map((h, k) => <div key={k}>• {h}<div className="bn">{hBn[k]}</div></div>)}</div>}
      {i === 0 && s.compliance && <div className="bp-note">آخر جولة ميدانية · <span className="bn">শেষ পরিদর্শন</span>: {s.compliance.pct}% {s.compliance.date ? "· " + s.compliance.date : ""}</div>}
      {i === 0 && s.fines > 0 && <div className="bp-note" style={{ color: "var(--bad-ink)" }}>غرامات مؤكدة · <span className="bn">জরিমানা</span>: {s.fines} ﷼</div>}
    </div></div>); })}
    <div className="bp-note" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}>الأرقام متوقعة حتى اعتماد المسير · <span className="bn">বেতন অনুমোদনের আগে এগুলো আনুমানিক</span></div>
  </>);
}

/* ================= وثائقي ================= */
function Docs({ me }) {
  const [docs, setDocs] = useState(null);
  const [notes, setNotes] = useState([]);
  const [reads, setReads] = useState({});
  const [holders, setHolders] = useState([]);
  useEffect(() => { (async () => {
    // جهات الاتصال حسب المنصب (owner/su1/su2/su3/sec_sup) عبر RPC doc_contacts — لتوجيه رسالة واتساب
    try {
      const { data: dc, error } = await supabase.rpc("doc_contacts");
      if (!error) setHolders(dc || []);
    } catch (e) {}
    // RLS (renewal_docs_self_sel) يعيد وثائق هذا البايكر فقط
    const { data } = await supabase.from("renewal_docs")
      .select("id,doc_type,subject,end_date,ref_no,active").eq("active", true).order("end_date", { ascending: true });
    setDocs((data || []).map(d => ({ ...d, _d: daysLeft(d.end_date) })));
    // آخر 5 إشعارات وثائق خاصة بالبايكر
    const { data: ns } = await supabase.from("notifications").select("id,title,body,severity,created_at,entity_id")
      .eq("category", "renewals").eq("audience", "user").eq("user_id", me.uid)
      .order("created_at", { ascending: false }).limit(5);
    const list = ns || [];
    setNotes(list);
    if (list.length) {
      // نفس آلية Notifications.jsx: notification_reads(notification_id,user_id,read_at)
      const { data: rd } = await supabase.from("notification_reads").select("notification_id,read_at")
        .eq("user_id", me.uid).in("notification_id", list.map(n => n.id));
      const m = {}; (rd || []).forEach(x => { if (x.read_at) m[x.notification_id] = x.read_at; });
      setReads(m);
      const un = list.filter(n => !m[n.id]);
      if (un.length) {
        const ts = new Date().toISOString();
        try { await supabase.from("notification_reads").upsert(un.map(n => ({ notification_id: n.id, user_id: me.uid, read_at: ts })), { onConflict: "notification_id,user_id" }); } catch (e) {}
      }
    }
  })(); }, [me.uid]);
  // رسالة واتساب تُوجَّه حسب تسلسل الصلاحيات: الوثائق الشخصية ← الموارد البشرية، وغيرها ← الدعم اللوجستي، ثم الخدمات المساندة، ثم المالك
  const msgFor = d => {
    const c = pickContact(d.doc_type, holders, ADMIN_WA);
    const txt = `السلام عليكم ${c.name ? "أ. " + c.name : ""} — ${c.dept.ar}\nأنا ${me.name || ""} (رقم البايكر ${me.biker_employee_id}). وثيقة ${d.doc_type} تنتهي بتاريخ ${d.end_date || ""} (${dayText(d._d)}). أرجو توجيهي لإجراءات التجديد.\n` +
      `আসসালামু আলাইকুম। আমি ${me.name || ""} (নম্বর ${me.biker_employee_id})। আমার ${docBn(d.doc_type)} ${d.end_date || ""} তারিখে শেষ হবে (${dayTextBn(d._d)})। নবায়নের জন্য নির্দেশনা দিন।`;
    window.open("https://wa.me/" + c.wa + "?text=" + encodeURIComponent(txt), "_blank");
  };
  const fmt = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB") : "—";
  return (
    <div className="bp-docs">
      {notes.length > 0 && <div className="bp-card g-card"><div className="bp-sec">
        <label className="bp-lbl" style={{ marginTop: 0 }}>تنبيهات وثائقي <span className="bn">/ কাগজপত্রের নোটিশ</span></label>
        {notes.map(n => <div className={"bp-item bp-ntf" + (reads[n.id] ? "" : " un")} key={n.id}>
          <div className="t"><span className={"g-badge " + (n.severity === "crit" ? "bad" : n.severity === "warn" ? "warn" : "info")}><i />{n.severity === "crit" ? "عاجل · জরুরি" : "تنبيه · সতর্কতা"}</span>{n.title}</div>
          {n.body && <div className="m" style={{ whiteSpace: "pre-line" }}>{n.body}</div>}
          <div className="m">{new Date(n.created_at).toLocaleString("ar")}</div>
        </div>)}
      </div></div>}
      <div className="bp-card g-card"><div className="bp-sec">
        <label className="bp-lbl" style={{ marginTop: 0 }}>وثائقي <span className="bn">/ আমার কাগজপত্র</span></label>
        {docs === null ? <Skel rows={2} card={false} />
        : docs.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا وثائق مسجّلة · <span className="bn">কোনো কাগজপত্র নেই</span></b></div>
        : docs.map(d => { const st = docStatus(d._d); return (
          <div className="bp-doc" key={d.id}>
            <div className="bp-doc-h">
              <div><div className="t">{d.doc_type}</div><div className="bn">{docBn(d.doc_type)}</div></div>
              <span className={"g-badge bp-dbadge " + st.tone}><b>{dayText(d._d)}</b><span className="bn">{dayTextBn(d._d)}</span></span>
            </div>
            <div className="m">تاريخ الانتهاء · <span className="bn">মেয়াদ শেষ</span>: <b>{fmt(d.end_date)}</b>{d.ref_no ? " · " + d.ref_no : ""}</div>
            {d._d != null && d._d <= 14 && (() => { const c = pickContact(d.doc_type, holders, ADMIN_WA); return (
              <button className="bp-btn bp-call bp-wa" onClick={() => msgFor(d)}>💬 رسالة واتساب إلى {c.dept.ar} · <span className="bn">{c.dept.bn}-কে হোয়াটসঅ্যাপ</span>{c.name && <small>{c.name}</small>}</button>); })()}
          </div>); })}
      </div></div>
    </div>
  );
}

/* حالة الإقرار: مُرسل (declared) ← مُراجع (reviewed/approved/confirmed) */
function StatusBadge({ s }) {
  if (!s) return null;
  const rev = ["reviewed", "approved", "confirmed", "accepted"].includes(s);
  return rev ? <span className="g-badge ok"><i />مُراجع · <span className="bn">পর্যালোচিত</span></span>
    : s === "rejected" ? <span className="g-badge bad"><i />مرفوض · <span className="bn">প্রত্যাখ্যাত</span></span>
    : <span className="g-badge info"><i />مُرسل · <span className="bn">জমা দেওয়া</span></span>;
}

/* ================= ابدأ من هنا: الخطوة التالية المطلوبة فقط ================= */
// الترتيب: استلام الدراجة (إن كان مطلوباً) ← الأكاديمية (إن لم تكتمل) ← نصيب اليوم (إن وُجد)
function StartHere({ me, myBike, pending, onGo, can = () => true }) {
  const [acad, setAcad] = useState(undefined);
  useEffect(() => { if (!me.emp_id) { setAcad(null); return; } let on = true;
    import("./academy/status").then(m => m.academyStatus(me.emp_id)).then(a => { if (on) setAcad(a); }, () => { if (on) setAcad(null); });
    return () => { on = false; }; }, [me.emp_id]);
  let st = null;
  if (myBike && myBike.needs_receipt_update) st = { k: "handover", ic: "🏍️", ar: "سجّل استلام دراجتك", bn: "আপনার বাইক গ্রহণ রেকর্ড করুন", sub: "قراءة العدّاد والصور في 7 خطوات قصيرة.", subBn: "ওডোমিটার ও ছবি — ৭টি ছোট ধাপে।", b: "افتح الدراجة", bBn: "বাইক খুলুন" };
  else if (acad && acad.ready && !acad.certified) st = { k: "academy", ic: "🎓", ar: "أكمل الأكاديمية", bn: "একাডেমি শেষ করুন", sub: `أنجزت ${acad.done || 0} محطات. أكمل المحطة التالية.`, subBn: `${acad.done || 0}টি ধাপ শেষ। পরের ধাপ করুন।`, b: "افتح الأكاديمية", bBn: "একাডেমি খুলুন" };
  else if (pending > 0) st = { k: "daily", ic: "📦", ar: "أكّد نصيبك اليوم", bn: "আজকের ভাগ নিশ্চিত করুন", sub: "زميلك سلّمك نصيباً من الشحنة، أكّد أنه وصلك.", subBn: "আপনার ভাগ এসেছে, নিশ্চিত করুন।", b: "افتح الاستلام", bBn: "ডেলিভারি খুলুন" };
  if (!st || !can(st.k)) return null;
  return <div className="bp-card g-card bp-start"><div className="bp-sec">
    <span className="bp-eyebrow">ابدأ من هنا · <span className="bn" style={{ display: "inline" }}>এখান থেকে শুরু করুন</span></span>
    <div className="bp-start-t"><span aria-hidden="true">{st.ic}</span><div><b>{st.ar}</b><span className="bn">{st.bn}</span></div></div>
    <div className="bp-note" style={{ marginTop: 4 }}>{st.sub}<span className="bn" style={{ display: "block" }}>{st.subBn}</span></div>
    <Btn kind="primary" block big style={{ marginTop: 12 }} onClick={() => onGo(st.k)} bn={st.bBn}>{st.b}</Btn>
  </div></div>;
}

/* ================= ملفي ================= */
function Profile({ me, myBike, onGo, can = () => true }) {
  const [ho, setHo] = useState(0);
  const [fl, setFl] = useState(0);
  useEffect(() => { (async () => {
    const { count: c1 } = await supabase.from("bike_handovers").select("id", { count: "exact", head: true });
    const { count: c2 } = await supabase.from("fuel_logs").select("id", { count: "exact", head: true });
    setHo(c1 || 0); setFl(c2 || 0);
  })(); }, []);
  return (
    <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl">بياناتي <span className="bn">/ আমার তথ্য</span></label>
      <div className="bp-item"><div className="t">الاسم · নাম: {me.name || "—"}</div><div className="m">رقم البايكر · বাইকার নম্বর: {me.biker_employee_id}</div></div>
      <div className="bp-item"><div className="t">الدراجة المخصّصة · নির্ধারিত বাইক: {myBike ? myBike.plate : "غير محدّدة — راجع الإدارة · নির্ধারিত নয়"}</div>{myBike && myBike.make && <div className="m">{myBike.make}</div>}</div>

      <label className="bp-lbl" style={{ marginTop: 14 }}>ملخّص سجلاتي <span className="bn">/ আমার রেকর্ড সারাংশ</span></label>
      <div className="bp-row">
        <div className="bp-pcell"><div className="k">تقارير الدراجة · বাইক রিপোর্ট</div><div className="v">{ho}</div></div>
        <div className="bp-pcell"><div className="k">تعبئات الوقود · রিফুয়েল</div><div className="v">{fl}</div></div>
      </div>

      {(can("handover") || can("fuel")) && <>
      <label className="bp-lbl" style={{ marginTop: 14 }}>النماذج <span className="bn">/ ফর্মসমূহ</span></label>
      <div className="bp-stack">{can("handover") && <Btn kind="secondary" block onClick={() => onGo("handover")} bn="বাইক হস্তান্তর / গ্রহণ">📋 تسليم / استلام الدراجة</Btn>}
      {can("fuel") && <Btn kind="secondary" block onClick={() => onGo("fuel")} bn="জ্বালানি রেকর্ড">⛽ تسجيل تعبئة وقود</Btn>}</div>
      <div className="bp-note">التوثيق المنتظم يحمي حقّك ويوضّح التزامك. · নিয়মিত ডকুমেন্টেশন আপনার অধিকার রক্ষা করে।</div>
      </>}
    </div></div>
  );
}

/* ---------- رفع صورة ---------- */
async function uploadPhoto(file, folder, bikerId) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `biker-portal/${folder}/${bikerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("field-evidence").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("field-evidence").getPublicUrl(path).data.publicUrl;
}

/* مربّع تصوير اتجاه واحد */
function PhotoBox({ id, cap, capBn, tag, file, onPick, checking }) {
  return (
    <label className={"bp-pbox" + (file ? " done" : "") + (checking ? " chk" : "")} htmlFor={id}>
      {file ? <img src={URL.createObjectURL(file)} alt="" /> : <><div className="em">📷</div><div className="cap">{cap}<span className="bn">{capBn}</span></div></>}
      <span className="tag">{tag}{file ? " ✓" : ""}</span>
      {checking && <span className="chkm">جارٍ فحص الوضوح… · <span lang="bn">যাচাই হচ্ছে…</span></span>}
      <input id={id} type="file" accept="image/*" capture="environment" onChange={e => { const x = (e.target.files || [])[0] || null; e.target.value = ""; onPick(x); }} />
    </label>
  );
}

/* رسالة عدم وجود دراجة مخصّصة */
function NoBike() {
  return <div className="bp-card g-card"><div className="bp-sec"><ErrorNote e={humanError(null, { kind: "nobike" })} /></div></div>;
}

/* ================= تسليم/استلام: سبع خطوات ================= */
const H_DRAFT = bid => "bp.handover." + bid;
const H_EMPTY = () => ({ step: 0, direction: "receive", odometer: "", checks: {}, ckNotes: {}, received: emptyReceived(), notes: "", pledge: false });
function Handover({ me, myBike, onDirty }) {
  const bid = me.biker_employee_id;
  const draft0 = React.useMemo(() => loadDraft(H_DRAFT(bid)), [bid]);
  const [f, setF] = useState(() => ({ ...H_EMPTY(), ...(draft0 || {}) }));     // كل المدخلات النصية (تُحفظ مسودةً)
  const [ph, setPh] = useState({});          // الصور: front/back/right/left/odometer + الصندوق الخمس (لا تُحفظ في المسودة)
  const [damages, setDamages] = useState([]);  // بطاقات الأضرار: [{id, close, wide, part, type, note}] (لا تُحفظ في المسودة)
  const [chk, setChk] = useState(null);        // حقل صورة قيد فحص الوضوح
  const [restored, setRestored] = useState(!!(draft0 && (draft0.odometer || Object.keys(draft0.checks || {}).length || draft0.step)));
  const [fe, setFe] = useState(null);        // خطأ تحقق بجانب الحقل {field, ar, bn}
  const [err, setErr] = useState(null);      // humanError عند الحفظ
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);    // {done,total}
  const [report, setReport] = useState(null); // {row, saved}: تقرير مفتوح
  const [recent, setRecent] = useState(null);
  const [redo, setRedo] = useState(null);    // إعادة تسجيل لسجل أُرجع للتصحيح: {id, reason}
  const uploaded = React.useRef(new Map());  // File → رابط: إعادة المحاولة تكمل من حيث توقفت
  const toast = useToast();
  const [dlg, ask] = useConfirm();
  const online = useOnline();
  const set = p => setF(x => ({ ...x, ...p }));
  // فحص وضوح الصورة قبل قبولها (الجهات الأربع والعدّاد وصور الأضرار)؛ المرفوضة لا تُحفظ وتظهر الرسالة بجانبها
  async function pickChecked(field, file, apply) {
    if (!file) return;
    setChk(field);
    const bad = await checkPhoto(file);
    setChk(null);
    if (bad) { setFe({ field, ar: bad.ar, bn: bad.bn }); return; }
    setFe(x => x && x.field === field ? null : x); apply(file);
  }
  const CHECKED = ["front", "back", "right", "left", "odometer"];
  const setP = k => file => { const apply = x => setPh(s => ({ ...s, [k]: x }));
    if (CHECKED.includes(k)) return pickChecked("ph_" + k, file, apply);
    apply(file); if (fe && fe.field === "ph_" + k) setFe(null); };
  const updD = (i, patch) => { setDamages(a => a.map((d, j) => j === i ? { ...d, ...patch } : d)); setFe(x => x && x.field.startsWith(`dmg_${i}_`) ? null : x); };
  const setR = patch => { set({ received: { ...f.received, ...patch } }); if (fe && fe.field.startsWith("rc_")) setFe(null); };
  const recv = f.direction === "receive", step = f.step, form = { ...f, photos: ph, damages };
  const S = HANDOVER_STEPS.length;

  async function loadRecent() {
    const { data } = await supabase.from("bike_handovers").select("*").order("created_at", { ascending: false }).limit(8);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);
  // المسودة: كل شيء عدا الصور، في sessionStorage
  useEffect(() => { const empty = !f.step && !f.odometer && !Object.keys(f.checks).length && !f.notes && !f.pledge && RECEIVED_ITEMS.every(it => f.received[it.id] == null);
    saveDraft(H_DRAFT(bid), empty ? null : f); }, [f]);
  // الصور غير محفوظة ⇒ تأكيد قبل الانتقال لتبويب آخر
  useEffect(() => { onDirty && onDirty(Object.values(ph).some(Boolean) || damages.length > 0); }, [ph, damages]);
  useEffect(() => () => { onDirty && onDirty(false); }, []);

  if (!myBike) return <NoBike />;

  const focusField = id => setTimeout(() => { const el = document.getElementById(id); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); try { el.focus({ preventScroll: true }); } catch (e) { /* */ } } }, 30);
  const goStep = i => { setFe(null); set({ step: i }); try { window.scrollTo(0, 0); } catch (e) { /* */ } };
  async function next() {
    const e = stepError(step, form);
    if (e) { setFe(e); focusField(e.field); return; }
    if (HANDOVER_STEPS[step].k === "check") {
      const n = CHECKLIST.filter(c => f.checks[c.id] === false).length;
      if (n >= 3 && !(await ask({ title: "تأكيد البنود", titleBn: "নিশ্চিত করুন", ar: `حدّدت ${n} بنود غير سليمة — هل هذا صحيح؟`, bn: `আপনি ${n} টি সমস্যা চিহ্নিত করেছেন — ঠিক আছে?`, ok: "نعم، صحيح", okBn: "হ্যাঁ, ঠিক", cancel: "راجع البنود", cancelBn: "আবার দেখুন" }))) return;
    }
    goStep(stepMove(step, 1, form));
  }
  const prev = () => goStep(stepMove(step, -1, form));
  async function cancel() {
    if (!(await ask({ title: "مسح النموذج؟", titleBn: "ফর্ম মুছবেন?", ar: "ستُمسح كل المدخلات والصور وتبدأ من جديد.", bn: "সব তথ্য ও ছবি মুছে নতুন করে শুরু হবে।", ok: "مسح", okBn: "মুছুন", cancel: "رجوع", cancelBn: "ফিরে যান" }))) return;
    reset();
  }
  function reset() { saveDraft(H_DRAFT(bid), null); setF(H_EMPTY()); setPh({}); setDamages([]); setRedo(null); setFe(null); setErr(null); setRestored(false); uploaded.current = new Map(); }

  async function submit() {
    setErr(null);
    const bad = firstStepError(form);
    if (bad) { goStep(bad.i); setFe(bad.err); focusField(bad.err.field); return; }
    setBusy(true);
    let photoNo = null;
    try {
      const { compressImage } = await import("./daily/compress");
      const box = boxNeeded(f.received);
      const jobs = [["front", "handover-front"], ["back", "handover-back"], ["right", "handover-right"], ["left", "handover-left"], ["odometer", "handover-odometer"],
        ...(box ? BOX_PHOTOS.map(b => [b.id, b.folder]) : [])].map(([k, folder]) => ({ k, folder, file: ph[k] }))
        .concat(damages.flatMap((d, i) => [{ k: `dmg${i}c`, folder: "handover-damage", file: d.close }, { k: `dmg${i}w`, folder: "handover-damage", file: d.wide }]));
      const urls = {}; let done = 0; setProg({ done: 0, total: jobs.length });
      for (const j of jobs) {
        let url = uploaded.current.get(j.file);
        if (!url) {
          photoNo = done + 1;
          let up = j.file;
          try { const b = await compressImage(j.file); up = new File([b], "photo.jpg", { type: "image/jpeg" }); } catch (e) { /* يُرفع الأصل إن تعذّر الضغط */ }
          url = await uploadPhoto(up, j.folder, bid);
          uploaded.current.set(j.file, url);
        }
        urls[j.k] = url; setProg({ done: ++done, total: jobs.length });
      }
      photoNo = null;
      // تفاصيل كل ضرر في photos.damage_items؛ damage_photos تبقى مصفوفة روابط (قريبة ثم بعيدة لكل ضرر) للتوافق
      const dmgItems = damages.map((d, i) => ({ close: urls[`dmg${i}c`], wide: urls[`dmg${i}w`], part: d.part, type: d.type, note: String(d.note || "").trim() }));
      const dmg = damagePhotosFlat(dmgItems);
      const boxPhotos = box ? Object.fromEntries(BOX_PHOTOS.map(b => [b.id, urls[b.id]])) : {};
      const rec = receivedRecord(f.received);
      const checks = Object.fromEntries(CHECKLIST.map(c => [c.id, f.checks[c.id] === true]));
      const ckN = Object.fromEntries(CHECKLIST.filter(c => !checks[c.id] && String(f.ckNotes[c.id] || "").trim()).map(c => [c.id, f.ckNotes[c.id].trim()]));
      const { data: saved, error } = await supabase.from("bike_handovers").insert({
        operator_id: me.operator_id, vehicle_id: myBike.id, plate: myBike.plate,
        biker_employee_id: bid, biker_name: me.name, direction: f.direction,
        odometer: Number(odoNum(f.odometer)),
        engine_sound_ok: checks.engine, items_ok: itemsOk(checks, f.received, CHECKLIST.map(c => c.id)),
        checklist: { ...checks, received: rec, ...(Object.keys(ckN).length ? { notes: ckN } : {}), ...(redo ? { redo_of: redo.id, redo_reason: redo.reason } : {}) },
        photo_front: urls.front, photo_back: urls.back, photo_right: urls.right, photo_left: urls.left, photo_odometer: urls.odometer,
        damage_photos: dmg,
        photos: { front: urls.front, back: urls.back, right: urls.right, left: urls.left, odometer: urls.odometer, damages: dmg, ...(dmgItems.length ? { damage_items: dmgItems } : {}), ...boxPhotos },
        condition_notes: f.notes || null, pledge_accepted: true, created_by: me.uid,
      }).select("*").single();
      if (error) throw error;
      if (recv) {
        // صلاحية البايكر الحالية (fleet_biker_self_upd) تسمح بتحديث بطاقة دراجته: الاستلام + حالة المفتاح إن استُلم
        const patch = { needs_receipt_update: false };
        if (rec.bike_key) { patch.key_status = `متوفر (${rec.bike_keys})`; patch.key_holder = `${me.name || ""} (${bid})`.trim(); }
        try { await supabase.from("fleet_vehicles").update(patch).eq("id", myBike.id); } catch (e) { /* لا يمنع الحفظ */ }
      }
      toast.ok(recv ? "تم حفظ الاستلام ✓" : "تم حفظ التسليم ✓", "সংরক্ষিত", 3000);
      if (saved) setReport({ row: saved, saved: true }); // التقرير يُفتح مباشرة بعد الحفظ
      reset(); loadRecent();
    } catch (e) { setErr(humanError(e, photoNo != null ? { photo: photoNo } : {})); }
    setBusy(false); setProg(null);
  }

  // سطر بنعم/لا (تُستدعى كدالة لا كمكوّن حتى لا يفقد حقل السبب التركيز)
  const YesNo = ({ it }) => {
    const v = f.received[it.id], r = f.received, mine = fe && fe.field === "rc_" + it.id;
    return <div className={"bp-rcv" + (mine ? " k-inv" : "")} key={it.id} id={"rc_" + it.id} tabIndex={-1}>
      <div className="bp-rcv-h"><span className="tx">{it.ar} <span className="bn">/ {it.bn}</span></span>
        <div className="bp-seg bp-yn" role="radiogroup" aria-label={it.ar}>
          <button type="button" role="radio" aria-checked={v === true} className={v === true ? "on yes" : ""} onClick={() => setR({ [it.id]: true })}>نعم<span className="bn">হ্যাঁ</span></button>
          {it.withNote && <button type="button" role="radio" aria-checked={v === "note"} className={v === "note" ? "on note" : ""} onClick={() => setR({ [it.id]: "note" })}>نعم مع ملاحظة<span className="bn">হ্যাঁ, তবে সমস্যা</span></button>}
          <button type="button" role="radio" aria-checked={v === false} className={v === false ? "on no" : ""} onClick={() => setR({ [it.id]: false })}>لا<span className="bn">না</span></button>
        </div></div>
      {v === true && it.count && <div className="bp-rcv-n"><span>كم مفتاح؟ · <span className="bn">কয়টি চাবি?</span></span>
        <div className="bp-seg">{[1, 2, 3].map(n => <button type="button" key={n} aria-pressed={r[it.count] === n} className={r[it.count] === n ? "on" : ""} onClick={() => setR({ [it.count]: n })}>{n}</button>)}</div></div>}
      {v === "note" && <input className="g-input bp-in" style={{ marginTop: 8 }} aria-label={"ملاحظة " + it.ar} value={r.reasons[it.id] || ""} placeholder="الملاحظة: ليس أصلياً، مكسور… · সমস্যা লিখুন" onChange={e => setR({ reasons: { ...r.reasons, [it.id]: e.target.value } })} />}
      {v === false && <input className="g-input bp-in" style={{ marginTop: 8 }} aria-label={"سبب " + it.ar} value={r.reasons[it.id] || ""} placeholder="السبب: لم يُسلَّم لي، مفقود… · কারণ" onChange={e => setR({ reasons: { ...r.reasons, [it.id]: e.target.value } })} />}
      {mine && <FieldErr t={fe} />}
      {it.id === "box" && v === false && <div className="bp-note">إن كان الصندوق موجوداً لكن فيه مشكلة (مثل «ليس أصلياً») فاختر «نعم مع ملاحظة» لتوثيقه بالصور. · <span className="bn">বক্স থাকলে কিন্তু সমস্যা থাকলে «হ্যাঁ, তবে সমস্যা» বাছুন।</span></div>}
    </div>;
  };
  const Mark = ({ v, t }) => <span className={"bp-mk " + (v == null ? "na" : v ? "ok" : "bad")} title={t}>{t} {v == null ? "—" : v ? "✓" : "✗"}</span>;
  const errAt = id => fe && fe.field === id ? <FieldErr t={fe} /> : null;
  const inv = id => fe && fe.field === id ? " k-inv" : "";
  const Box = (id, k, cap, capBn, tag) => <div className={inv("ph_" + k)}><PhotoBox id={"ph_" + k} cap={cap} capBn={capBn} tag={tag} file={ph[k]} onPick={setP(k)} checking={chk === "ph_" + k} /></div>;
  const badList = CHECKLIST.filter(c => f.checks[c.id] === false);
  const rcText = it => { const v = f.received[it.id]; return v === true ? "نعم" + (it.count ? ` (${f.received[it.count]})` : "") : v === "note" ? "نعم مع ملاحظة" : v === false ? "لا" : "—"; };

  let body;
  const k = HANDOVER_STEPS[step].k;
  if (k === "odo") body = <>
    <div className="bp-bike"><span className="ic">🏍️</span><div><div className="p">{myBike.plate}</div>{myBike.make && <div className="m">{myBike.make}</div>}</div></div>
    <label className="bp-lbl">نوع العملية <span className="bn">/ অপারেশন ধরন</span></label>
    <div className="bp-seg" role="radiogroup" aria-label="نوع العملية">
      <button type="button" role="radio" aria-checked={recv} className={recv ? "on" : ""} onClick={() => set({ direction: "receive" })}>استلام<span className="bn">গ্রহণ</span></button>
      <button type="button" role="radio" aria-checked={!recv} className={!recv ? "on" : ""} onClick={() => set({ direction: "return" })}>تسليم<span className="bn">হস্তান্তর</span></button>
    </div>
    <label className="bp-lbl" htmlFor="odometer">قراءة العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার (কিমি)</span></label>
    <input id="odometer" className={"g-input bp-in" + inv("odometer")} inputMode="numeric" value={f.odometer} onChange={e => { set({ odometer: odoNum(e.target.value) }); if (fe && fe.field === "odometer") setFe(null); }} placeholder="14230" dir="ltr" style={{ textAlign: "right" }} />
    {errAt("odometer")}
    <label className="bp-lbl">صورة العدّاد <span className="bp-req">*</span> <span className="bn">/ ওডোমিটারের ছবি</span></label>
    <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr" }}>{Box("o", "odometer", "صورة العدّاد", "ওডোমিটার", "العداد")}</div>
    {errAt("ph_odometer")}</>;
  else if (k === "photos") body = <>
    <div className="bp-note" style={{ marginTop: 0 }}>صوّر الدراجة كاملة من كل جهة. · <span className="bn">চারদিক থেকে পুরো বাইকের ছবি তুলুন।</span></div>
    <div className="bp-pgrid">{Box("f", "front", "أمامي", "সামনে", "أمام")}{Box("b", "back", "خلفي", "পিছনে", "خلف")}{Box("r", "right", "يمين", "ডান", "يمين")}{Box("l", "left", "يسار", "বাম", "يسار")}</div>
    {["front", "back", "right", "left"].map(x => <React.Fragment key={x}>{errAt("ph_" + x)}</React.Fragment>)}</>;
  else if (k === "check") body = <>
    <div className="bp-note" style={{ marginTop: 0 }}>افحص كل بند واختر «سليم» أو «غير سليم». · <span className="bn">প্রতিটি দেখে «ঠিক» বা «সমস্যা» বাছুন।</span></div>
    <div className="bp-chklist">
      {CHECKLIST.map(c => { const v = f.checks[c.id]; return <div className={"bp-ck2" + inv("ck_" + c.id)} key={c.id} id={"ck_" + c.id} tabIndex={-1}>
        <div className="bp-ck2-h"><span className="tx">{c.ar}<span className="bn">{c.bn}</span></span>
          <div className="bp-ok2" role="radiogroup" aria-label={c.ar}>
            <button type="button" role="radio" aria-checked={v === true} className={v === true ? "on yes" : ""} onClick={() => { set({ checks: { ...f.checks, [c.id]: true } }); if (fe && fe.field === "ck_" + c.id) setFe(null); }}>✓ سليم<span className="bn">ঠিক</span></button>
            <button type="button" role="radio" aria-checked={v === false} className={v === false ? "on no" : ""} onClick={() => { set({ checks: { ...f.checks, [c.id]: false } }); if (fe && fe.field === "ck_" + c.id) setFe(null); }}>✗ غير سليم<span className="bn">সমস্যা</span></button>
          </div></div>
        {v === false && <input className="g-input bp-cknote" aria-label={"وصف " + c.ar} value={f.ckNotes[c.id] || ""} placeholder="وصف قصير (اختياري) · সংক্ষেপে লিখুন" onChange={e => set({ ckNotes: { ...f.ckNotes, [c.id]: e.target.value } })} />}
        {errAt("ck_" + c.id)}
      </div>; })}
    </div></>;
  else if (k === "recv") body = <>
    <label className="bp-lbl" style={{ marginTop: 0 }}>{recv ? "ما استلمته" : "ما سلّمته"} <span className="bp-req">*</span> <span className="bn">/ {recv ? "যা পেয়েছি" : "যা দিয়েছি"}</span></label>
    <div className="bp-chklist">{RECEIVED_ITEMS.map(it => YesNo({ it }))}</div></>;
  else if (k === "box") body = <>
    <div className="bp-note" style={{ marginTop: 0 }}>{f.received.box === "note" ? "صوّر الصندوق ليظهر ما في الملاحظة." : "صوّر الصندوق من كل جهة ومن الداخل مفتوحاً."} · <span className="bn">বক্সের পাঁচটি ছবি তুলুন।</span></div>
    <div className="bp-pgrid">
      {BOX_PHOTOS.map((b, i) => <div key={b.id} style={i === 4 ? { gridColumn: "1 / -1" } : undefined}>{Box(b.id, b.id, b.ar, b.bn, b.tag)}</div>)}
    </div>
    {BOX_PHOTOS.map(b => <React.Fragment key={b.id}>{errAt("ph_" + b.id)}</React.Fragment>)}</>;
  else if (k === "notes") body = <>
    <label className="bp-lbl" style={{ marginTop: 0 }}>الأضرار (اختياري) <span className="bn">/ ক্ষতি (ঐচ্ছিক)</span></label>
    <div className="bp-note" style={{ marginTop: 0 }}>لكل ضرر: صورة قريبة، وصورة بعيدة يظهر فيها مكانه، ثم المكان والنوع ووصف قصير. · <span className="bn">প্রতিটি ক্ষতির জন্য: কাছের ছবি, দূরের ছবি, জায়গা, ধরন ও ছোট বিবরণ।</span></div>
    {damages.map((d, i) => { const id = x => `dmg_${i}_${x}`; return <div className="bp-dmg" key={d.id}>
      <div className="bp-dmg-h"><span>الضرر {i + 1} <span className="bn" style={{ fontSize: 11, color: "var(--mut)" }}>/ ক্ষতি {i + 1}</span></span>
        <button type="button" onClick={() => { setDamages(a => a.filter((_, j) => j !== i)); setFe(null); }} aria-label={"حذف الضرر " + (i + 1)}>حذف · <span lang="bn">মুছুন</span></button></div>
      <div className="bp-pgrid">
        <div className={inv(id("close"))}><PhotoBox id={id("close")} cap="صورة قريبة للضرر" capBn="কাছ থেকে" tag="قريبة" file={d.close} checking={chk === id("close")} onPick={x => pickChecked(id("close"), x, f2 => updD(i, { close: f2 }))} /></div>
        <div className={inv(id("wide"))}><PhotoBox id={id("wide")} cap="صورة بعيدة يظهر فيها المكان" capBn="দূর থেকে, জায়গা দেখা যায়" tag="بعيدة" file={d.wide} checking={chk === id("wide")} onPick={x => pickChecked(id("wide"), x, f2 => updD(i, { wide: f2 }))} /></div>
      </div>
      {errAt(id("close"))}{errAt(id("wide"))}
      <label className="bp-lbl">مكان الضرر <span className="bp-req">*</span> <span className="bn">/ ক্ষতির জায়গা</span></label>
      <div className={"bp-chips" + inv(id("part"))} id={id("part")} tabIndex={-1} role="radiogroup" aria-label={"مكان الضرر " + (i + 1)}>
        {DAMAGE_PARTS.map(o => <button type="button" key={o.v} role="radio" aria-checked={d.part === o.v} className={d.part === o.v ? "on" : ""} onClick={() => updD(i, { part: o.v })}>{o.ar}<span className="bn">{o.bn}</span></button>)}
      </div>{errAt(id("part"))}
      <label className="bp-lbl">نوع الضرر <span className="bp-req">*</span> <span className="bn">/ ক্ষতির ধরন</span></label>
      <div className={"bp-chips" + inv(id("type"))} id={id("type")} tabIndex={-1} role="radiogroup" aria-label={"نوع الضرر " + (i + 1)}>
        {DAMAGE_TYPES.map(o => <button type="button" key={o.v} role="radio" aria-checked={d.type === o.v} className={d.type === o.v ? "on" : ""} onClick={() => updD(i, { type: o.v })}>{o.ar}<span className="bn">{o.bn}</span></button>)}
      </div>{errAt(id("type"))}
      <label className="bp-lbl" htmlFor={id("note")}>وصف قصير <span className="bp-req">*</span> <span className="bn">/ ছোট বিবরণ</span></label>
      <input id={id("note")} className={"g-input bp-in" + inv(id("note"))} value={d.note} maxLength={300} onChange={e => updD(i, { note: e.target.value })} placeholder="مثال: خدش طويل على غطاء الخزان · যেকোনো ভাষায় লিখুন" />
      {errAt(id("note"))}
    </div>; })}
    {damages.length < MAX_DAMAGES ? <Btn kind="secondary" block style={{ marginTop: 10 }} onClick={() => { setDamages(a => [...a, emptyDamage()]); if (fe && fe.field === "dmg_add") setFe(null); }} bn="ক্ষতি যোগ করুন">+ إضافة ضرر</Btn>
      : <div className="bp-note">وصلت للحد الأقصى ({MAX_DAMAGES} أضرار). · <span className="bn">সর্বোচ্চ {MAX_DAMAGES}টি।</span></div>}
    {errAt("dmg_add")}
    <label className="bp-lbl" htmlFor="h_notes">ملاحظات الحالة (اختياري) <span className="bn">/ অবস্থার নোট</span></label>
    <textarea id="h_notes" className="g-textarea bp-ta" value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="أي عطل أو خدش… · কোনো ত্রুটি বা দাগ…" /></>;
  else body = <>
    <div className="bp-rev">
      {[[0, "نوع العملية", recv ? "استلام · গ্রহণ" : "تسليم · হস্তান্তর"], [0, "العدّاد", (f.odometer || "—") + " كم"],
        [1, "صور الدراجة", [ph.front, ph.back, ph.right, ph.left, ph.odometer].filter(Boolean).length + " / 5"],
        [2, "قائمة التحقق", badList.length ? badList.length + " غير سليم: " + badList.map(c => c.short).join("، ") : "كلها سليمة ✓"],
        ...RECEIVED_ITEMS.map(it => [3, it.ar, rcText(it)]),
        ...(boxNeeded(f.received) ? [[4, "صور الصندوق", BOX_PHOTOS.filter(b => ph[b.id]).length + " / 5"]] : []),
        [5, "الأضرار والملاحظات", (damages.length ? damages.length + " ضرر: " + damages.map(d => `${damagePart(d.part).ar} (${damageType(d.type).ar})`).join("، ") : "لا أضرار") + (f.notes.trim() ? " · " + f.notes.trim().slice(0, 40) : "")],
      ].map(([i, l, v], n) => <div className="bp-rev-r" key={n}><span className="l">{l}</span><b>{v}</b><Btn kind="text" onClick={() => goStep(i)} aria-label={"تعديل " + l}>تعديل</Btn></div>)}
    </div>
    <label className={"bp-chk pledge" + inv("pledge")} htmlFor="pledge">
      <input id="pledge" type="checkbox" checked={f.pledge} onChange={e => { set({ pledge: e.target.checked }); if (fe && fe.field === "pledge") setFe(null); }} />
      <span className="tx" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.7 }}>
        أتعهّد بالمحافظة على الدراجة والالتزام بتعليمات المرور، وأتحمّل مسؤولية أي أضرار تنتج عن سوء الاستخدام.
        <span className="bn" style={{ display: "block", marginTop: 3 }}>আমি বাইকের যত্ন নেওয়া ও ট্রাফিক নিয়ম মেনে চলার অঙ্গীকার করছি এবং অপব্যবহারজনিত যেকোনো ক্ষতির দায় নিচ্ছি।</span>
      </span>
    </label>
    {errAt("pledge")}</>;

  const last = step === S - 1;
  const shown = HANDOVER_STEPS.map((x, i) => ({ ...x, i })).filter(x => !stepSkipped(x.i, form));
  const pos = shown.findIndex(x => x.i === step) + 1;
  // حالة آخر تسجيل: بانتظار المراجعة / تمت المراجعة / يحتاج تصحيح (مع السبب وزر «أعد التسجيل»)
  const lastRec = latestRow(recent), lastSt = lastRec ? handoverState(lastRec) : null, lastFix = lastRec ? fixInfo(lastRec) : null;
  const startRedo = () => { setRedo({ id: lastRec.id, reason: lastFix ? lastFix.reason : "" }); set({ direction: lastRec.direction || "receive" }); goStep(0); };
  return (<>
    {lastRec && step === 0 && !redo && <div className="bp-card g-card" style={{ borderInlineStart: `4px solid var(--${lastSt === "needs_fix" ? "bad" : lastSt === "reviewed" ? "ok" : "warn"})` }}><div className="bp-sec">
      <div style={{ fontWeight: 900, fontSize: 14 }}>حالة آخر تسجيل · <span className="bn" style={{ fontWeight: 600, color: "var(--mut)" }}>শেষ রেকর্ডের অবস্থা</span></div>
      <div style={{ marginTop: 6 }}><span className={"g-badge " + H_STATES[lastSt].tone}><i />{H_STATES[lastSt].ar} · <span lang="bn">{H_STATES[lastSt].bn}</span></span>
        <span style={{ fontSize: 12, color: "var(--mut)", marginInlineStart: 8 }}>{lastRec.direction === "receive" ? "استلام" : "تسليم"} · {new Date(lastRec.created_at).toLocaleString("ar")}</span></div>
      {lastSt === "needs_fix" && <>
        <div className="bp-msg" role="alert" style={{ background: "var(--bad-bg)", color: "var(--bad-ink)" }}>السبب: {lastFix ? lastFix.reason : "—"}<Bn>কারণ: {lastFix ? lastFix.reason : "—"}</Bn></div>
        <Btn kind="primary" block style={{ marginTop: 10 }} onClick={startRedo} bn="আবার রেকর্ড করুন">↻ أعد التسجيل</Btn>
      </>}
    </div></div>}
    <div className="bp-card g-card bp-free"><div className="bp-sec">
      {redo && step === 0 && <div className="bp-msg" role="status" style={{ background: "var(--warn-bg)", color: "var(--warn-ink)", marginTop: 0, marginBottom: 10 }}>↻ إعادة تسجيل بعد طلب تصحيح: {redo.reason}<Bn>সংশোধনের পর আবার রেকর্ড: {redo.reason}</Bn></div>}
      <div className="bp-wiz-top">
        {step > 0 ? <Btn kind="secondary" onClick={prev} disabled={busy} bn="আগের">→ السابق</Btn>
          : (f.odometer || Object.keys(f.checks).length || Object.values(ph).some(Boolean)) ? <Btn kind="secondary" onClick={cancel} disabled={busy} bn="বাতিল">✕ إلغاء</Btn> : <span />}
        <span className="bp-wiz-n" aria-label={`الخطوة ${pos} من ${shown.length}`}>{pos} / {shown.length}</span>
      </div>
      <div className="dr-dots bp-dots" aria-hidden="true">{shown.map(x => <i key={x.i} className={x.i < step ? "done" : x.i === step ? "now" : ""} />)}</div>
      <h2 className="bp-wiz-h">{HANDOVER_STEPS[step].ar}<span className="bn">{HANDOVER_STEPS[step].bn}</span></h2>
      {restored && step === 0 && <div className="bp-msg bp-ok" role="status">استعدنا مدخلاتك السابقة. الصور لا تُحفظ، فالتقطها مرة أخرى. · <span className="bn">আগের তথ্য ফিরে এসেছে। ছবি আবার তুলুন।</span></div>}
      {body}
      {err && <div style={{ marginTop: 12 }}><ErrorNote e={err} who={bid} busy={busy} onRetry={submit} onLogin={() => supabase.auth.signOut()} onView={() => goStep(0)} /></div>}
      <StickyBar>
        {busy && prog && <UploadBar done={prog.done} total={prog.total} />}
        {last ? <Btn kind="primary" block big busy={busy} disabled={!online} onClick={submit} bn={busy ? "সংরক্ষণ হচ্ছে…" : "রিপোর্ট সংরক্ষণ"}>{busy ? "جارٍ الحفظ…" : "حفظ التقرير"}</Btn>
          : <Btn kind="primary" block big onClick={next} bn="পরের ধাপ">التالي</Btn>}
        {last && !online && <OfflineHint />}
      </StickyBar>
    </div></div>
    {step === 0 && <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl" style={{ marginTop: 0 }}>آخر سجلاتك <span className="bn">/ সর্বশেষ রেকর্ড</span></label>
      <div className="bp-list">
        {recent === null ? <Skel rows={2} card={false} /> : recent.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
          recent.map(r => { const rc = (r.checklist || {}).received || {}; return <div className="bp-item bp-item-open" key={r.id} role="button" tabIndex={0} onClick={() => setReport({ row: r })} onKeyDown={e => { if (e.key === "Enter") setReport({ row: r }); }}>
            <div className="t">{r.plate || "—"} · {r.direction === "receive" ? "استلام · গ্রহণ" : "تسليم · হস্তান্তর"} · العدّاد {r.odometer}{(() => { const k = handoverState(r); return <span className={"g-badge " + H_STATES[k].tone}><i />{H_STATES[k].ar} · <span className="bn">{H_STATES[k].bn}</span></span>; })()}</div>
            <div className="m">{new Date(r.created_at).toLocaleString("ar")}</div>
            <div className="bp-mks"><Mark v={rc.box} t="📦 صندوق" /><Mark v={rc.bike_key} t="🔑 مفتاح الدراجة" /><Mark v={rc.box_key} t="🗝️ مفتاح الصندوق" /><span className="bp-open">عرض التقرير ‹ <span className="bn">রিপোর্ট দেখুন</span></span></div>
          </div>; })}
      </div>
    </div></div>}
    {dlg}
    {report && <Suspense fallback={null}><HandoverReport row={report.row} mode="biker" saved={report.saved} onClose={() => setReport(null)} /></Suspense>}
  </>);
}

/* ================= سجل الوقود ================= */
const F_DRAFT = bid => "bp.fuel." + bid;
function Fuel({ me, myBike }) {
  const bid = me.biker_employee_id;
  const d0 = React.useMemo(() => loadDraft(F_DRAFT(bid)) || {}, [bid]);
  const [fuelType, setFuelType] = useState(d0.fuelType || "petrol");
  const [odometer, setOdometer] = useState(d0.odometer || "");
  const [amount, setAmount] = useState(d0.amount || "");
  const [liters, setLiters] = useState(d0.liters || "");
  const [odoFile, setOdoFile] = useState(null);
  const [recFile, setRecFile] = useState(null);
  const [notes, setNotes] = useState(d0.notes || "");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const [fe, setFe] = useState(null), [err, setErr] = useState(null);
  const uploaded = React.useRef(new Map()); // File → رابط: إعادة المحاولة تكمل من حيث توقفت
  const toast = useToast();
  const online = useOnline();
  const [recent, setRecent] = useState(null);
  const dec = v => odoNum(v);

  async function loadRecent() {
    const { data } = await supabase.from("fuel_logs")
      .select("id,plate,fuel_type,odometer,amount,fill_at").order("fill_at", { ascending: false }).limit(8);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);
  useEffect(() => { saveDraft(F_DRAFT(bid), { fuelType, odometer, amount, liters, notes }); }, [fuelType, odometer, amount, liters, notes]);

  if (!myBike) return <NoBike />;
  const focusField = id => setTimeout(() => { const el = document.getElementById(id); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); try { el.focus({ preventScroll: true }); } catch (e) { /* */ } } }, 30);
  const need = (field, ar, bn) => { setFe({ field, ar, bn }); focusField(field); };

  async function submit() {
    setErr(null); setFe(null);
    if (!odometer) return need("f_odometer", "أدخل قراءة العدّاد.", "ওডোমিটার লিখুন।");
    if (!amount) return need("f_amount", "أدخل المبلغ.", "পরিমাণ লিখুন।");
    if (!odoFile) return need("f_odo", "التقط صورة العدّاد.", "ওডোমিটারের ছবি তুলুন।");
    if (!recFile) return need("f_rec", "التقط صورة الفاتورة — إرفاقها إلزامي.", "রসিদের ছবি দিন — বাধ্যতামূলক।");
    setBusy(true);
    let photoNo = null;
    try {
      const jobs = [[odoFile, "fuel-odometer"], [recFile, "fuel-receipt"]], urls = [];
      setProg({ done: 0, total: jobs.length });
      for (let i = 0; i < jobs.length; i++) {
        const [file, folder] = jobs[i];
        let url = uploaded.current.get(file);
        if (!url) { photoNo = i + 1; url = await uploadPhoto(file, folder, bid); uploaded.current.set(file, url); }
        urls.push(url); setProg({ done: i + 1, total: jobs.length });
      }
      photoNo = null;
      const { error } = await supabase.from("fuel_logs").insert({
        operator_id: me.operator_id, vehicle_id: myBike.id, plate: myBike.plate,
        biker_employee_id: bid, biker_name: me.name, fuel_type: fuelType,
        odometer: Number(odometer), amount: Number(amount), liters: liters ? Number(liters) : null,
        odometer_photo_url: urls[0], receipt_photo_url: urls[1], notes: notes || null, created_by: me.uid,
      });
      if (error) throw error;
      toast.ok("تم تسجيل التعبئة ✓", "সংরক্ষিত", 3000);
      saveDraft(F_DRAFT(bid), null); uploaded.current = new Map();
      setOdometer(""); setAmount(""); setLiters(""); setOdoFile(null); setRecFile(null); setNotes(""); loadRecent();
    } catch (e) { setErr(humanError(e, photoNo != null ? { photo: photoNo } : {})); }
    setBusy(false); setProg(null);
  }
  const errAt = id => fe && fe.field === id ? <FieldErr t={fe} /> : null;
  const inv = id => fe && fe.field === id ? " k-inv" : "";

  return (<>
    <div className="bp-card g-card bp-free"><div className="bp-sec">
      <h2 className="bp-wiz-h" style={{ marginTop: 0 }}>تسجيل تعبئة وقود<span className="bn">জ্বালানি রেকর্ড</span></h2>
      <div className="bp-bike"><span className="ic">🏍️</span><div><div className="p">{myBike.plate}</div>{myBike.make && <div className="m">{myBike.make}</div>}</div></div>

      <label className="bp-lbl">النوع <span className="bn">/ ধরন</span></label>
      <div className="bp-seg" role="radiogroup" aria-label="النوع">
        <button type="button" role="radio" aria-checked={fuelType === "petrol"} className={fuelType === "petrol" ? "on" : ""} onClick={() => setFuelType("petrol")}>بنزين<span className="bn">পেট্রল</span></button>
        <button type="button" role="radio" aria-checked={fuelType === "oil"} className={fuelType === "oil" ? "on" : ""} onClick={() => setFuelType("oil")}>زيت<span className="bn">অয়েল</span></button>
      </div>

      <div className="bp-row">
        <div><label className="bp-lbl" htmlFor="f_odometer">العدّاد (كم) <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার</span></label>
          <input id="f_odometer" className={"g-input bp-in" + inv("f_odometer")} inputMode="numeric" value={odometer} onChange={e => { setOdometer(dec(e.target.value)); setFe(null); }} placeholder="14230" dir="ltr" style={{ textAlign: "right" }} />{errAt("f_odometer")}</div>
        <div><label className="bp-lbl" htmlFor="f_amount">المبلغ (ريال) <span className="bp-req">*</span> <span className="bn">/ পরিমাণ</span></label>
          <input id="f_amount" className={"g-input bp-in" + inv("f_amount")} inputMode="decimal" value={amount} onChange={e => { setAmount(dec(e.target.value)); setFe(null); }} placeholder="50" dir="ltr" style={{ textAlign: "right" }} />{errAt("f_amount")}</div>
      </div>
      <label className="bp-lbl" htmlFor="f_liters">اللترات (اختياري) <span className="bn">/ লিটার (ঐচ্ছিক)</span></label>
      <input id="f_liters" className="g-input bp-in" inputMode="decimal" value={liters} onChange={e => setLiters(dec(e.target.value))} placeholder="8.2" dir="ltr" style={{ textAlign: "right" }} />

      <label className="bp-lbl">صورة العدّاد والفاتورة <span className="bp-req">*</span> <span className="bn">/ ওডোমিটার ও রসিদের ছবি</span></label>
      <div className="bp-pgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className={inv("f_odo")}><PhotoBox id="f_odo" cap="صورة العدّاد" capBn="ওডোমিটার" tag="العداد" file={odoFile} onPick={x => { setOdoFile(x); setFe(null); }} /></div>
        <div className={inv("f_rec")}><PhotoBox id="f_rec" cap="صورة الفاتورة" capBn="রসিদ" tag="الفاتورة *" file={recFile} onPick={x => { setRecFile(x); setFe(null); }} /></div>
      </div>
      {errAt("f_odo")}{errAt("f_rec")}
      <div className="bp-note">إرفاق الفاتورة إلزامي لاعتماد التعبئة. · <span className="bn">রসিদ সংযুক্ত করা আবশ্যক।</span></div>

      <label className="bp-lbl" htmlFor="f_notes">ملاحظات (اختياري) <span className="bn">/ নোট</span></label>
      <textarea id="f_notes" className="g-textarea bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="…" />

      {err && <div style={{ marginTop: 12 }}><ErrorNote e={err} who={bid} busy={busy} onRetry={submit} onLogin={() => supabase.auth.signOut()} /></div>}
      <StickyBar>
        {busy && prog && <UploadBar done={prog.done} total={prog.total} />}
        <Btn kind="primary" block big busy={busy} disabled={!online} onClick={submit} bn={busy ? "সংরক্ষণ হচ্ছে…" : "রিফুয়েল সংরক্ষণ"}>{busy ? "جارٍ الحفظ…" : "حفظ التعبئة"}</Btn>
        {!online && <OfflineHint />}
      </StickyBar>
    </div></div>
    <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl" style={{ marginTop: 0 }}>سجل تعبئاتك <span className="bn">/ আপনার রিফুয়েল রেকর্ড</span></label>
      <div className="bp-list">
        {recent === null ? <Skel rows={2} card={false} /> : recent.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
          recent.map(r => <div className="bp-item" key={r.id}>
            <div className="t">{r.plate || "—"} · {r.fuel_type === "oil" ? "زيت · অয়েল" : "بنزين · পেট্রল"} · {r.amount ? r.amount + "﷼" : "—"} · العدّاد {r.odometer}<span className="g-badge info"><i />مُرسل · <span className="bn">জমা দেওয়া</span></span></div>
            <div className="m">{new Date(r.fill_at).toLocaleString("ar")}</div>
          </div>)}
      </div>
    </div></div>
  </>);
}

/* ================= العهدة (الأدوات والمواد) ================= */
const condAr = (v) => (CONDITIONS.find(c => c.v === v) || {}).ar || v;
function Assets({ me }) {
  const [rows, setRows] = useState(() => Object.fromEntries(
    ASSET_ITEMS.map(it => [it.key, { present: false, qty: 1, condition: "good", photo: null }])
  ));
  const [notes, setNotes] = useState("");
  const [pledge, setPledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const online = useOnline();
  const [fe, setFe] = useState(null), [err, setErr] = useState(null);
  const [recent, setRecent] = useState(null);

  async function loadRecent() {
    const { data } = await supabase.from("biker_assets")
      .select("id,items,notes,status,created_at").order("created_at", { ascending: false }).limit(6);
    setRecent(data || []);
  }
  useEffect(() => { loadRecent(); }, []);

  function setItem(key, patch) { setRows(s => ({ ...s, [key]: { ...s[key], ...patch } })); }
  const reset = () => setRows(Object.fromEntries(ASSET_ITEMS.map(it => [it.key, { present: false, qty: 1, condition: "good", photo: null }])));

  const focusField = id => setTimeout(() => { const el = document.getElementById(id); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); try { el.focus({ preventScroll: true }); } catch (e) { /* */ } } }, 30);
  async function submit() {
    setErr(null); setFe(null);
    const chosen = ASSET_ITEMS.filter(it => rows[it.key].present);
    if (chosen.length === 0) { setFe({ field: "as_list", ar: "حدّد العناصر التي استلمتها أولاً.", bn: "অন্তত একটি সরঞ্জাম নির্বাচন করুন।" }); focusField("as_list"); return; }
    if (!pledge) { setFe({ field: "as_pledge", ar: "وافق على التعهّد قبل الحفظ.", bn: "সংরক্ষণের আগে অঙ্গীকারে সম্মতি দিন।" }); focusField("as_pledge"); return; }
    setBusy(true);
    try {
      const bid = me.biker_employee_id;
      const items = [];
      for (const it of chosen) {
        const r = rows[it.key];
        let photoUrl = null;
        if (r.photo) { try { photoUrl = await uploadPhoto(r.photo, "asset-" + it.key, bid); } catch (e) {} }
        items.push({ key: it.key, name_ar: it.ar, name_bn: it.bn, qty: Number(r.qty) || 1, condition: r.condition, photo: photoUrl });
      }
      const { error } = await supabase.from("biker_assets").insert({
        operator_id: me.operator_id, biker_employee_id: bid, biker_name: me.name,
        items, pledge_accepted: true, notes: notes || null, status: "declared", created_by: me.uid,
      });
      if (error) throw error;
      toast.ok("تم تسجيل العهدة ✓", "সংরক্ষিত", 3000);
      reset(); setNotes(""); setPledge(false); loadRecent();
    } catch (e) { setErr(humanError(e)); }
    setBusy(false);
  }

  return (
    <><div className="bp-card g-card bp-free"><div className="bp-sec">
      <h2 className="bp-wiz-h" style={{ marginTop: 0 }}>إقرار العهدة — الأدوات والمواد<span className="bn">সরঞ্জাম ও উপকরণের ঘোষণা</span></h2>
      <div className="bp-note" style={{ marginBottom: 4 }}>حدّد ما استلمته، والكمية، وحالته، وصوّر الصنف. · আপনি যা পেয়েছেন তা নির্বাচন করুন, পরিমাণ ও অবস্থা দিন এবং ছবি তুলুন।</div>

      <div className={"bp-chklist" + (fe && fe.field === "as_list" ? " k-inv" : "")} id="as_list" tabIndex={-1}>
        {ASSET_ITEMS.map(it => {
          const r = rows[it.key];
          const ref = it.img ? TOOLREFS[it.img] : null;
          return (
            <div className={"bp-aitem" + (r.present ? " on" : "")} key={it.key}>
              <label className="bp-arow" htmlFor={"as_" + it.key}>
                {ref ? <img className="bp-aref" src={ref} alt="" /> : <div className="bp-aref ph">🧰</div>}
                <input id={"as_" + it.key} type="checkbox" checked={r.present} onChange={e => { setItem(it.key, { present: e.target.checked }); setFe(null); }} />
                <span className="tx">{it.ar} <span className="bn">/ {it.bn}</span></span>
              </label>
              {r.present && (
                <div style={{ padding: "0 13px 12px" }}>
                  <div className="bp-row" style={{ gap: 8 }}>
                    <div style={{ flex: "0 0 32%" }}>
                      <label className="bp-lbl" style={{ margin: "0 0 4px", fontSize: 11.5 }}>الكمية <span className="bn">/ পরিমাণ</span></label>
                      <input className="g-input bp-in" type="number" inputMode="numeric" min="1" value={r.qty}
                        onChange={e => setItem(it.key, { qty: e.target.value })} style={{ padding: "9px 11px" }} />
                    </div>
                    <div>
                      <label className="bp-lbl" style={{ margin: "0 0 4px", fontSize: 11.5 }}>الحالة <span className="bn">/ অবস্থা</span></label>
                      <select className="g-select bp-sel" value={r.condition} onChange={e => setItem(it.key, { condition: e.target.value })} style={{ padding: "9px 11px" }}>
                        {CONDITIONS.map(c => <option key={c.v} value={c.v}>{c.ar} / {c.bn}</option>)}
                      </select>
                    </div>
                  </div>
                  <label className="bp-lbl" style={{ margin: "8px 0 4px", fontSize: 11.5 }}>صورة الصنف (اختياري) <span className="bn">/ ছবি (ঐচ্ছিক)</span></label>
                  <label className="bp-acap" htmlFor={"asph_" + it.key}>
                    {r.photo ? <img className="bp-athumb" src={URL.createObjectURL(r.photo)} alt="" /> : <>📷 تصوير الصنف · ছবি তুলুন</>}
                    {r.photo && <span className="bp-done">✓ تم · হয়েছে</span>}
                    <input id={"asph_" + it.key} type="file" accept="image/*" capture="environment"
                      onChange={e => setItem(it.key, { photo: (e.target.files || [])[0] || null })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="bp-lbl">ملاحظات (اختياري) <span className="bn">/ নোট (ঐচ্ছিক)</span></label>
      <textarea className="g-textarea bp-ta" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي تفاصيل عن العهدة… · সরঞ্জাম সম্পর্কে বিস্তারিত…" />

      {fe && fe.field === "as_list" && <FieldErr t={fe} />}
      <label className={"bp-chk pledge" + (fe && fe.field === "as_pledge" ? " k-inv" : "")} htmlFor="as_pledge">
        <input id="as_pledge" type="checkbox" checked={pledge} onChange={e => { setPledge(e.target.checked); setFe(null); }} />
        <span className="tx" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.7 }}>
          أُقرّ وأتعهّد بأن ما ذكرته أعلاه صحيح، وأنني استلمت هذه العهدة وأتحمّل مسؤوليتها والمحافظة عليها.
          <span className="bn" style={{ display: "block", marginTop: 3 }}>আমি ঘোষণা করছি যে উপরের তথ্য সঠিক, আমি এই সরঞ্জাম বুঝে নিয়েছি এবং এর যত্ন ও দায়িত্ব নিচ্ছি।</span>
        </span>
      </label>

      {fe && fe.field === "as_pledge" && <FieldErr t={fe} />}
      {err && <div style={{ marginTop: 12 }}><ErrorNote e={err} who={me.biker_employee_id} busy={busy} onRetry={submit} onLogin={() => supabase.auth.signOut()} /></div>}
      <StickyBar>
        <Btn kind="primary" block big busy={busy} disabled={!online} onClick={submit} bn={busy ? "সংরক্ষণ হচ্ছে…" : "ঘোষণা সংরক্ষণ"}>{busy ? "جارٍ الحفظ…" : "حفظ إقرار العهدة"}</Btn>
        {!online && <OfflineHint />}
      </StickyBar>
    </div></div>
    <div className="bp-card g-card"><div className="bp-sec">
      <label className="bp-lbl" style={{ marginTop: 0 }}>آخر إقراراتك <span className="bn">/ সর্বশেষ ঘোষণা</span></label>
      <div className="bp-list">
        {recent === null ? <Skel rows={2} card={false} /> : recent.length === 0 ? <div className="g-empty" style={{ padding: "18px 10px" }}><b>لا يوجد بعد · <span className="bn">এখনও নেই</span></b></div> :
          recent.map(r => {
            const its = Array.isArray(r.items) ? r.items : [];
            return (
              <div className="bp-item" key={r.id}>
                <div className="t">{its.length} عنصر · {its.length} টি সরঞ্জাম<StatusBadge s={r.status} /></div>
                <div className="m">{its.map(x => `${x.name_ar}${x.qty > 1 ? "×" + x.qty : ""} (${condAr(x.condition)})`).join("، ")}</div>
                <div className="m">{new Date(r.created_at).toLocaleString("ar")}</div>
              </div>
            );
          })}
      </div>
    </div></div></>
  );
}
