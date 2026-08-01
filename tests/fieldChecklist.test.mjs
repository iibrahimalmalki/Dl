import {ITEMS,bikerItems,mgmtItems,compliance,effect} from '../src/fieldChecklist.js';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
ok('14 items / 9 biker / 5 mgmt',ITEMS.length===14&&bikerItems.length===9&&mgmtItems.length===5);
const allPass={};bikerItems.forEach(i=>allPass[i.n]='pass');
ok('all pass=100 ok',compliance(allPass).pct===100&&effect(100).key==='ok');
const mix={};bikerItems.slice(0,5).forEach(i=>mix[i.n]='pass');bikerItems.slice(5).forEach(i=>mix[i.n]='fail');
ok('55.6 deduct',compliance(mix).pct===55.6&&effect(55.6).key==='deduct');
const ex={};bikerItems.slice(0,8).forEach(i=>ex[i.n]='pass');ex[bikerItems[8].n]='excused';
ok('excused denom',compliance(ex).denom===8&&compliance(ex).pct===100);
