// دخول البايكر: idToEmail و bikerLoginId (src/bikerLogin.js)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
const tmp=fs.mkdtempSync(path.join(process.cwd(),'.bl-test-'));
try{
execSync(`npx esbuild src/bikerLogin.js --bundle --format=esm --platform=node --outfile=${tmp}/t.mjs --log-level=error`,{stdio:'inherit'});
const L=await import(`${tmp}/t.mjs`);
const eq=(inp,out)=>ok(`idToEmail(${JSON.stringify(inp)}) = ${out}`,L.idToEmail(inp)===out);
eq('1700','biker1700@dalu.sa');
eq('١٧٠٠','biker1700@dalu.sa');
eq(' 1 7 0 0 ','biker1700@dalu.sa');
eq('biker1700','biker1700@dalu.sa');
eq('Biker1700','biker1700@dalu.sa');
eq('biker1700@dalu.sa','biker1700@dalu.sa');
eq('BIKER1700@DALU.SA','biker1700@dalu.sa');
eq('abed','biker.abed@dalu.sa');
eq('Abed','biker.abed@dalu.sa');
eq('biker.abed','biker.abed@dalu.sa');
eq('biker.abed@dalu.sa','biker.abed@dalu.sa');
eq('966532233373@dalu.team','966532233373@dalu.team');
eq('','');
ok('bikerLoginId: biker1700@dalu.sa ⇒ 1700',L.bikerLoginId('biker1700@dalu.sa')==='1700');
ok('bikerLoginId: biker.abed@dalu.sa ⇒ abed',L.bikerLoginId('biker.abed@dalu.sa')==='abed');
ok('bikerLoginId: بريد آخر يبقى كما هو',L.bikerLoginId('966532233373@dalu.team')==='966532233373@dalu.team');
ok('ذهاب وإياب: idToEmail(bikerLoginId(x)) = x',['biker1700@dalu.sa','biker.abed@dalu.sa','biker1624@dalu.sa'].every(e=>L.idToEmail(L.bikerLoginId(e))===e));
ok('hasBikerAlias',L.hasBikerAlias('biker1700@dalu.sa')&&L.hasBikerAlias('biker.abed@dalu.sa')&&!L.hasBikerAlias('966532233373@dalu.team'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
