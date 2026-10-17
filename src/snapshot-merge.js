const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const keyed=array=>Array.isArray(array)&&array.every(item=>object(item)&&typeof item.id==='string')&&new Set(array.map(item=>item.id)).size===array.length;

// Merge independent fields and records against the last confirmed common snapshot.
// Concurrent replacements keep the latest local edit and preserve the other value.
export function mergeSnapshots(base,local,remote){
 const recoveries=[];
 function records(value,out=new Map()){if(!value||typeof value!=='object')return out;if(value.kind==='study'&&value.id&&value.stageId)out.set(value.id,value.stageId);for(const child of Object.values(value))if(child&&typeof child==='object')records(child,out);return out}
 const beforeRecords=records(base),localRecords=records(local),remoteRecords=records(remote),bothRecorded=new Set();const localNewStages=new Set([...localRecords].filter(([id])=>!beforeRecords.has(id)&&!remoteRecords.has(id)).map(([,stage])=>stage));for(const [id,stage]of remoteRecords)if(localNewStages.has(stage)&&!beforeRecords.has(id)&&!localRecords.has(id))bothRecorded.add(stage);
 function merge(b,l,r,path=[]){
  if(['activeExamId','activePlanningId','session'].includes(path.at(-1)))return clone(l);
  if(path.at(-1)==='dailyPlan')return null;
  if(path.at(-1)==='done'&&bothRecorded.has(path.at(-2))&&[b,l,r].every(Number.isFinite)&&l>=b&&r>=b)return b+(l-b)+(r-b);
  if((equal(l,r)&&!(bothRecorded.size&&l&&typeof l==='object'))||equal(b,r))return clone(l);
  if(equal(b,l))return clone(r);
  if(l===undefined||r===undefined){const survivor=l===undefined?r:l;recoveries.push({path:path.join('.'),value:clone(survivor),reason:'deleted-and-edited'});return undefined;}
  if(keyed(l)&&keyed(r)&&(b===undefined||keyed(b))){
   const bm=new Map((b||[]).map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x]));
   const ids=[...new Set([...r.map(x=>x.id),...l.map(x=>x.id)])],out=[];
   for(const id of ids){const value=merge(bm.get(id),lm.get(id),rm.get(id),[...path,id]);if(value!==undefined)out.push(value)}
   // Keep an explicit local reorder, otherwise accept the remote order.
   const oldIds=(b||[]).map(x=>x.id).filter(id=>lm.has(id)),localIds=l.map(x=>x.id).filter(id=>bm.has(id));
   if(!equal(oldIds,localIds)){const rank=new Map(l.map((x,i)=>[x.id,i]));out.sort((a,c)=>(rank.get(a.id)??Infinity)-(rank.get(c.id)??Infinity));}
   return out;
  }
  if(object(l)&&object(r)&&(b===undefined||object(b))){const out={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){if(['__proto__','constructor','prototype'].includes(key))continue;const value=merge(b?.[key],l[key],r[key],[...path,key]);if(value!==undefined)out[key]=value}return out;}
    recoveries.push({path:path.join('.'),value:clone(r),reason:'concurrent-edit'});return clone(l);
 }
 function canonical(state){
  const result=clone(state);
  if(!Array.isArray(result?.exams)||!result.exams.length)return result;
  const active=result.exams.find(e=>e.id===result.activeExamId);
  if(active){const data={};for(const [key,value]of Object.entries(result))if(!['exams','activeExamId','ui','syncRecovery'].includes(key))data[key]=clone(value);data.examUi={setupStarted:!!result.ui?.setupStarted,setupGoalsComplete:!!result.ui?.setupGoalsComplete};active.data=data;}
  for(const exam of result.exams){const data=exam.data,plan=data?.plannings?.find(p=>p.id===data.activePlanningId);if(plan?.data){for(const key of ['stages','roundId','initialCompletedCycles','goals','planner','measurementMode']){if(data[key]!==undefined)plan.data[key]=clone(data[key]);delete data[key]}if(data.edital?.plan){plan.data.editalPlan=clone(data.edital.plan);delete data.edital.plan;}}}
  return {exams:result.exams,activeExamId:result.activeExamId,ui:result.ui,syncRecovery:result.syncRecovery||[]};
 }
 const b=canonical(base),l=canonical(local),r=canonical(remote),result=merge(b,l,r);
 if(Array.isArray(result?.exams)&&!result.exams.length&&Array.isArray(local.subjects)){const data=clone(local);for(const key of ['exams','activeExamId','ui','syncRecovery'])delete data[key];Object.assign(data,{subjects:[],stages:[],history:[],reviews:[],session:null,previousSession:null,plannings:[],archivedPlannings:[],activePlanningId:null,edital:{subjects:[],plan:{}},dailyPlan:null,roundId:globalThis.crypto.randomUUID(),initialCompletedCycles:0});data.goals={...data.goals,daily:0,weekly:0,dailyTasks:0,weeklyTasks:0};result.exams=[{id:globalThis.crypto.randomUUID(),name:'Meus estudos anteriores',contest:'Meus estudos',sourceId:'legacy',data}];}

 if(Array.isArray(result?.exams)&&result.exams.length){
  result.activeExamId=result.exams.some(e=>e.id===local.activeExamId)?local.activeExamId:result.exams[0].id;
  for(const exam of result.exams){const localExam=l.exams?.find(e=>e.id===exam.id),data=exam.data;if(!data)continue;const activeId=localExam?.data?.activePlanningId;if(data.plannings?.some(p=>p.id===activeId))data.activePlanningId=activeId;else if(!data.plannings?.some(p=>p.id===data.activePlanningId))data.activePlanningId=data.plannings?.[0]?.id||null;const plan=data.plannings?.find(p=>p.id===data.activePlanningId);if(plan?.data){const fields=['stages','roundId','initialCompletedCycles','goals','planner','measurementMode'];for(const key of fields)if(plan.data[key]!==undefined)data[key]=clone(plan.data[key]);if(plan.data.editalPlan)data.edital={...data.edital,plan:clone(plan.data.editalPlan)};}if(data.stages===undefined)data.stages=[];}
  const active=result.exams.find(e=>e.id===result.activeExamId);Object.assign(result,clone(active.data));
  result.session=result.activeExamId===local.activeExamId?clone(local.session??null):null;
 }
 function repair(data){if(!Array.isArray(data?.subjects))return;const ids=new Set(data.subjects.map(m=>m.id)),records=new Set((data.history||[]).map(h=>h.id));function keep(items,predicate,path){return (items||[]).filter(item=>{if(predicate(item))return true;recoveries.push({path,value:clone(item),reason:'reference-removed'});return false})}for(const target of [data,...(data.plannings||[]).map(p=>p.data),...(data.archivedPlannings||[]).map(p=>p.data)])if(target?.stages)target.stages=keep(target.stages,s=>ids.has(s.subjectId),'stages');if(data.edital?.subjects)data.edital.subjects=keep(data.edital.subjects,m=>ids.has(m.subjectId),'edital.subjects');if(data.reviews)data.reviews=keep(data.reviews,review=>!!review.manualSource||records.has(review.studyId),'reviews');}
 repair(result);for(const exam of result.exams||[])repair(exam.data);
 if(recoveries.length){const now=new Date().toISOString();result.syncRecovery=[...(result.syncRecovery||[]),...recoveries.map((entry,i)=>({id:globalThis.crypto.randomUUID(),savedAt:now,...entry}))];}
 return result;
}

export function snapshotPatch(from,to,path=[],ops=[]){
 if(equal(from,to))return ops;
 if(Array.isArray(from)&&Array.isArray(to)){for(let i=0;i<to.length;i++)snapshotPatch(from[i],to[i],[...path,i],ops);if(from.length!==to.length)ops.push({path,length:to.length});return ops;}
 if(object(from)&&object(to)){for(const key of new Set([...Object.keys(from),...Object.keys(to)]))if(!['__proto__','constructor','prototype'].includes(key))snapshotPatch(from[key],to[key],[...path,key],ops);return ops;}
 ops.push(to===undefined?{path,remove:true}:{path,value:clone(to)});return ops;
}
export function applySnapshotPatch(value,ops){let result=clone(value);for(const op of ops){if(op.path.some(key=>['__proto__','constructor','prototype'].includes(key)))throw new Error('Caminho de sincronização inválido.');if(!op.path.length){if(op.length!==undefined)result.length=op.length;else result=clone(op.value);continue}let parent=result;for(let i=0;i<op.path.length-1;i++){const key=op.path[i];if(!parent[key]||typeof parent[key]!=='object')parent[key]=typeof op.path[i+1]==='number'?[]:{};parent=parent[key];}const key=op.path.at(-1);if(op.length!==undefined){let array=parent[key];if(!Array.isArray(array))parent[key]=array=[];array.length=op.length;}else if(op.remove)delete parent[key];else parent[key]=clone(op.value);}return result;}
