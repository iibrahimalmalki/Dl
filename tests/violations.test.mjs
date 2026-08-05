import {VIOLATIONS,byCode,objectionState,internalDeadline,seriousRepeat} from '../src/violations.js';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
ok('22 violations',VIOLATIONS.length===22);
ok('severity 4/5/7/6',[['critical',4],['high',5],['medium',7],['low',6]].every(([s,n])=>VIOLATIONS.filter(v=>v.sev===s).length===n));
ok('code1 fine/win',byCode(1).fine===1000&&byCode(1).win===72);
ok('internal 48h',internalDeadline('2026-05-10T10:00:00.000Z')==='2026-05-12T10:00:00.000Z');
ok('serious repeat',seriousRepeat([{sweater_id:'1700',code:16,logged_at:'2026-05-01T09:00:00Z'},{sweater_id:'1700',code:16,logged_at:'2026-05-03T09:00:00Z'},{sweater_id:'1700',code:16,logged_at:'2026-05-05T09:00:00Z'}],'1700',16,'2026-05-05T09:00:00Z')===true);
