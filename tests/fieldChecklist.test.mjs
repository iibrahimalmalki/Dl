import {ITEMS,bikerItems,mgmtItems,compliance,effect,supplyReadiness} from '../src/fieldChecklist.js';
const ok=(l,c)=>{console.log((c?'✓':'✗ FAIL')+' '+l);if(!c)process.exitCode=1;};
ok('15 items / 9 biker / 6 mgmt',ITEMS.length===15&&bikerItems.length===9&&mgmtItems.length===6);
ok('item 15 (box condition) is mgmt and follows item 2',ITEMS.find(i=>i.n===15).resp==='mgmt'&&ITEMS.findIndex(i=>i.n===15)===ITEMS.findIndex(i=>i.n===2)+1);
const allPass={};bikerItems.forEach(i=>allPass[i.n]='pass');
ok('all pass=100 ok',compliance(allPass).pct===100&&effect(100).key==='ok');
const mix={};bikerItems.slice(0,5).forEach(i=>mix[i.n]='pass');bikerItems.slice(5).forEach(i=>mix[i.n]='fail');
ok('55.6 deduct',compliance(mix).pct===55.6&&effect(55.6).key==='deduct');
const ex={};bikerItems.slice(0,8).forEach(i=>ex[i.n]='pass');ex[bikerItems[8].n]='excused';
ok('excused denom',compliance(ex).denom===8&&compliance(ex).pct===100);

// v1.1: تقرير ميدول 30/09 — نقل سبب الدهان إلى البند 15 لا يخفّض درجة البايكر
const midul={1:'fail',2:'excused',15:'fail',3:'pass',4:'fail',5:'pass',6:'pass',7:'pass',8:'pass',9:'pass',10:'pass',11:'pass',12:'fail',13:'pass'};
const mc=compliance(midul);
ok('midul 6/7 = 85.7 ok + item 14 not assessed',mc.pct===85.7&&mc.denom===7&&effect(mc.pct).key==='ok'&&mc.notAssessed.length===1&&mc.notAssessed[0]===14);
const sr=supplyReadiness(midul);
ok('supply readiness 3/6 = 50',sr.pct===50&&sr.denom===6&&sr.missing.length===3);
ok('effect carries financial note',typeof effect(70).fin==='string'&&effect(70).fin.length>10);
