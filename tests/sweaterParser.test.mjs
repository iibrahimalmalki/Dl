import {parseBookings,parseQC,parseTickets,buildBikerMonth,canonStatus} from '../src/sweaterParser.js';
const ok=(l,g,w)=>{const p=JSON.stringify(g)===JSON.stringify(w);console.log((p?'✓':'✗ FAIL')+` ${l}`);if(!p){console.log('  got',JSON.stringify(g),'want',JSON.stringify(w));process.exitCode=1;}};
const bookings=[
 {'Booking ID':1,'Biker Name':'Midul Hassan','Biker ID':'1648','Booking Status':'collect_payment','Booking Date':'2026-05-03'},
 {'Booking ID':2,'Biker Name':'Midul Hassan','Biker ID':'1648','Booking Status':'cancel_client','Booking Date':'2026-05-03'},
 {'Booking ID':3,'Biker Name':'Midul Hassan','Biker ID':'1648','Booking Status':'cancel_admin','Booking Date':'2026-05-04'},
];
const pb=parseBookings(bookings);const midul=pb.bikers.find(b=>b.sweater_id==='1648');
ok('net washes excludes cancel_admin',midul.net_washes,2);
ok('status canon',[canonStatus('Collect Payment'),canonStatus('CANCEL_CLIENT'),canonStatus('cancel-admin')],['collect_payment','cancel_client','cancel_admin']);
const qc=parseQC([{'Biker ID':'1648','Rating':'4.60'}]);ok('qc rating',qc['1648'].rating,4.6);
