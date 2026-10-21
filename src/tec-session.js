/* Shared, credential-free TEC session validation and time allocation. */
(function(root){
 'use strict';
 const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
 const key=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function events(input){
  if(!Array.isArray(input)||input.length>10000)throw Error('A sessão deve ter no máximo 10.000 respostas.');
  const seen=new Set();return input.map(e=>{
   if(!e||typeof e.id!=='string'||!e.id||e.id.length>180)throw Error('Resposta sem identificação válida.');
   if(seen.has(e.id))return null;seen.add(e.id);
   const correct=Number(e.correct),wrong=Number(e.wrong),elapsed=Number(e.elapsed);
   if(!Number.isInteger(correct)||!Number.isInteger(wrong)||correct<0||wrong<0||correct+wrong<1||correct+wrong>1000000||!Number.isFinite(elapsed)||elapsed<0||elapsed>604800)throw Error('Confira os resultados e o tempo das respostas.');
   return {id:e.id,subject:clean(e.subject).slice(0,160)||'Matéria não identificada',topic:clean(e.topic).slice(0,1000)||'Tópico não identificado',correct,wrong,elapsed,ts:Number(e.ts)||0};
  }).filter(Boolean).sort((a,b)=>a.elapsed-b.elapsed||a.ts-b.ts||a.id.localeCompare(b.id));
 }
 function groups(input,totalSeconds){
  const rows=events(input);if(!Number.isInteger(totalSeconds)||totalSeconds<0||totalSeconds>604800)throw Error('Tempo total inválido.');
  const map=new Map();let previous=0,last=null;
  for(const e of rows){const k=JSON.stringify([key(e.subject),key(e.topic)]);if(!map.has(k))map.set(k,{id:'g'+map.size,subject:e.subject,topic:e.topic,correct:0,wrong:0,weight:0,questionIds:[]});const g=map.get(k);g.correct+=e.correct;g.wrong+=e.wrong;g.questionIds.push(e.id);const at=Math.min(totalSeconds,e.elapsed);g.weight+=Math.max(0,at-previous);previous=Math.max(previous,at);last=g;}
  if(last)last.weight+=Math.max(0,totalSeconds-previous);const result=[...map.values()],weight=result.reduce((n,g)=>n+g.weight,0),count=result.reduce((n,g)=>n+g.correct+g.wrong,0);
  let assigned=0;for(const g of result){const exact=totalSeconds*(weight?g.weight/weight:(g.correct+g.wrong)/(count||1));g.seconds=Math.floor(exact);g.remainder=exact-g.seconds;assigned+=g.seconds;}
  for(const g of result.slice().sort((a,b)=>b.remainder-a.remainder).slice(0,totalSeconds-assigned))g.seconds++;
  return result.map(({weight,remainder,...g})=>g);
 }
 root.CicloTecSession={clean,key,events,groups};
})(globalThis);
