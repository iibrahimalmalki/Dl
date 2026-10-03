// حالة الأكاديمية لموظف واحد (للعرض في التعاقد والإعداد) — تُستورد كسولاً
import{loadMine}from"./store";
import{stateFrom,certified,doneCount}from"./engine";
export async function academyStatus(empId){
  const r=await loadMine(empId);
  if(!r.ready)return{ready:false};
  const st=stateFrom(r.attempts,r.practicals);
  return{ready:true,certified:certified(st),done:doneCount(st)};
}
