/* Read-only projection. Call only after verifying this user's report access. */
(function(root){
'use strict';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' '),key=r=>JSON.stringify([norm(r.discipline),norm(r.topic)]);
function merge(rows){const m=new Map();for(const r of rows){if(!r||typeof r.discipline!=='string'||typeof r.topic!=='string'||![r.total,r.correct].every(v=>Number.isSafeInteger(v)&&v>=0)||r.correct>r.total)continue;const k=key(r),p=m.get(k);m.set(k,p?{...p,total:p.total+r.total,correct:p.correct+r.correct}:{discipline:r.discipline,topic:r.topic,total:r.total,correct:r.correct});}return [...m.values()];}
function compute(payload,options={}){
 const p=payload||{},ins=p.insights||{},bank=options.bank||ins.mainBank||'Geral',cut=options.cut||'9999-12-31',source=ins.practiceSource||'all',hs=(p.histories||[]).filter(h=>h&&h.end<=cut&&Array.isArray(h.rows));
 const general=bank==='Geral',consolidated=general&&ins.generalTecSource!=='banks'&&hs.some(h=>h.bank==='Geral'),names=general?(consolidated?['Geral']:[...new Set(hs.map(h=>h.bank).filter(b=>b!=='Geral'))]):[bank];
 let rows=[];if(source!=='practice')for(const name of names){let imported=[];for(const h of hs.filter(h=>h.bank===name).sort((a,b)=>a.end.localeCompare(b.end)))imported=h.mode==='snapshot'?h.rows:merge([...imported,...h.rows]);rows.push(...imported);}
 if(source!=='tec')for(const a of [...(p.manualAttempts||[]),...(p.cycleAttempts||[])]){if(!a||a.date>cut||!general&&a.bank!==bank)continue;if(options.examId&&a.examId&&a.examId!==options.examId)continue;const correct=a.correct,wrong=a.wrong;if(![correct,wrong].every(v=>Number.isSafeInteger(v)&&v>=0))continue;rows.push({discipline:a.discipline,topic:a.course?a.course+' · '+a.topic:a.topic,total:correct+wrong,correct});}
 rows=merge(rows);const matters=new Map();for(const r of rows){const k=norm(r.discipline),g=matters.get(k)||{total:0,correct:0};g.total+=r.total;g.correct+=r.correct;matters.set(k,g);}
 return {bank,items:rows.filter(r=>r.total>0&&r.correct*100<r.total*80).map(r=>{const g=matters.get(norm(r.discipline));return {...r,wrong:r.total-r.correct,rate:100*r.correct/r.total,disciplinePriority:g.correct*100<g.total*80,smallSample:r.total<10};}).sort((a,b)=>Number(b.disciplinePriority)-Number(a.disciplinePriority)||a.rate-b.rate||b.wrong-a.wrong||a.topic.localeCompare(b.topic,'pt-BR'))};
}
root.StudyPerformancePriorities={compute,norm};
})(globalThis);
