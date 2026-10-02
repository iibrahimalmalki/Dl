// npm test — يشغّل كل tests/*.test.mjs بالتتابع ويفشل إن فشل أيّها
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).sort();
let failed=[];
for(const f of files){
  const r=spawnSync(process.execPath,['tests/'+f],{encoding:'utf8'});
  const out=(r.stdout||'')+(r.stderr||'');
  const pass=(out.match(/^✓/gm)||[]).length,fail=(out.match(/✗ FAIL/g)||[]).length;
  const bad=r.status!==0||fail>0;
  console.log(`${bad?'✗':'✓'} ${f} — ${pass} passed${fail?`, ${fail} failed`:''}`);
  if(bad){failed.push(f);console.log(out.split('\n').filter(l=>/FAIL|Error/.test(l)).join('\n'));}
}
console.log(failed.length?`\n${failed.length} file(s) failed`:`\nall ${files.length} files passed`);
process.exit(failed.length?1:0);
