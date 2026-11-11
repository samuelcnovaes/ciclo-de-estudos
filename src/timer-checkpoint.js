// Small local timer recovery record; the study snapshot is saved separately.
(function(root){
'use strict';
const context=state=>[state.activeExamId||null,state.activePlanningId||null,state.roundId||null];
function clear(storage,key){try{storage.removeItem(key+':timer');}catch{}}
function write(storage,key,state,now=Date.now()){
 if(!state.session)return true;
 try{storage.setItem(key+':timer',JSON.stringify({version:1,context:context(state),savedAt:now,session:state.session}));return true;}catch{return false;}
}
function recover(storage,key,state,now=Date.now()){
 try{const checkpoint=JSON.parse(storage.getItem(key+':timer')||'null'),saved=checkpoint?.session,current=state.session;
 if(checkpoint?.version!==1||JSON.stringify(checkpoint.context)!==JSON.stringify(context(state))||!current||!saved||saved.stageId!==current.stageId||saved.studyStartedAt!==current.studyStartedAt||!Number.isFinite(saved.elapsed)||saved.elapsed<Math.max(0,Number(current.elapsed)||0)||!['elapsed','timer','pomodoro'].includes(saved.mode)||!['work','rest'].includes(saved.phase)||!Number.isFinite(saved.phaseLeft)||saved.phaseLeft<=0)return false;
 state.session={...saved,running:false,last:now};return true;
 }catch{return false;}
}
root.CicloTimerCheckpoint={clear,write,recover};
})(globalThis);
