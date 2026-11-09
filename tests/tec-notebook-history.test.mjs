import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const bridge=readFileSync('src/tec-planner-bridge.js','utf8');
function setup(){
 const dom=new JSDOM('<div class="account-menu"></div><dialog id="focusDialog"></dialog>',{url:'https://samuelcnovaes.github.io/ciclo-de-estudos/',runScripts:'outside-only'}),w=dom.window;w.structuredClone=structuredClone;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let state={ui:{tecIntegrationEnabled:true},activeExamId:'exam',activePlanningId:'plan',subjects:[{id:'a',name:'Direito'}],questionNotebooks:[{id:'topic',subjectId:'a',course:'Meu material',title:'ICMS',topic:'ICMS',kind:'topic',target:null}],history:[{id:'old',kind:'study',subjectId:'a',topic:'ICMS',correct:3,wrong:1,seconds:300,date:'2026-11-05T12:00:00Z',externalSource:{provider:'tec'}},{id:'other',kind:'study',subjectId:'a',correct:2,wrong:0,seconds:60,date:'2026-11-04T12:00:00Z',externalSource:{provider:'tec'}}],stages:[],pom:{work:25}};
 let persist=true;const api={getState:()=>state,setState:s=>{state=s},accountId:'account',uid:()=>w.crypto.randomUUID(),esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),persist:()=>persist,render:()=>{},toast:()=>{},settle:()=>{},sessionStage:()=>({}),stageName:()=>''};w.eval(readFileSync('src/tec-session.js','utf8'));w.eval(readFileSync('src/theory-tracker.js','utf8'));w.eval(bridge);w.CicloTecPlanner.install(api);
 const send=(payload,type='notebookHistory')=>new Promise(resolve=>{const id=w.crypto.randomUUID(),listener=e=>{const m=JSON.parse(e.detail);if(m.requestId!==id)return;w.document.removeEventListener('ciclo-tec-response',listener);resolve(m)};w.document.addEventListener('ciclo-tec-response',listener);w.document.dispatchEvent(new w.CustomEvent('ciclo-tec-request',{detail:JSON.stringify({channel:'ciclo-tec-v1',direction:'request',requestId:id,type,context:{accountId:'account',examId:'exam',planningId:'plan'},payload})}));});
 const payload=()=>({notebookId:'123',title:'Caderno ICMS',total:19,correct:18,wrong:1,readAt:Date.now()});
 const choose=()=>{w.document.getElementById('tecNotebookHistoryDestination').value='topic';w.document.getElementById('tecNotebookHistoryDestination').dispatchEvent(new w.Event('change'));};const submit=()=>w.document.getElementById('tecNotebookHistoryForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
 return {w,send,payload,choose,submit,state:()=>state,fail:()=>persist=false};
}
test('notebook totals replace the material display without adding or changing any historical record',async()=>{
 const t=setup(),{w}=t;try{const before=structuredClone(t.state().history);
 assert.equal((await t.send(t.payload())).ok,true);t.choose();assert.equal(w.document.querySelector('[data-tec-existing]'),null);assert.match(w.document.getElementById('tecNotebookHistoryPreview').textContent,/19 resolvidas/);t.submit();
 assert.equal(w.document.getElementById('tecNotebookHistoryDialog').open,false);assert.deepEqual(t.state().history,before);assert.equal(t.state().questionNotebooks[0].tecNotebookSnapshot.total,19);
 await t.send(t.payload());t.choose();t.submit();assert.deepEqual(t.state().history,before);assert.equal(t.state().questionNotebooks.length,1);
 await t.send({...t.payload(),total:21,correct:20});t.choose();t.submit();assert.deepEqual(t.state().history,before);assert.equal(t.state().questionNotebooks[0].tecNotebookSnapshot.total,21);
 }finally{w.close();}
});
test('notebook import rejects active timers malformed totals and stale reads; failed save rolls back',async()=>{
 const t=setup();try{assert.equal((await t.send({...t.payload(),total:22})).ok,false);assert.equal((await t.send({...t.payload(),readAt:Date.now()-120000})).ok,false);t.state().session={};assert.equal((await t.send(t.payload())).ok,false);delete t.state().session;await t.send(t.payload());t.choose();const before=structuredClone(t.state());t.fail();t.submit();assert.deepEqual(t.state(),before);}finally{t.w.close();}
});
test('TEC reader reads the displayed notebook totals rather than the gadget all-day counts',()=>{
 const source=readFileSync('integrations/tec-planejamento.user.js','utf8'),start=source.indexOf(' function readCurrentNotebook(){'),end=source.indexOf(' function readPerformanceTopics(){',start),dom=new JSDOM('<a href="/questoes/cadernos/123">Meu caderno</a><div>Questão 57 de 121 <span>(19 Resolvidas, <b>18 Acertos</b> e <b>1 Erros</b>)</span></div><div id="tec-planner-widget">(999 Resolvidas, 999 Acertos e 0 Erros)</div>',{url:'https://www.tecconcursos.com.br/questoes/cadernos/123',runScripts:'outside-only'});
 try{dom.window.eval(source.slice(start,end)+';window.readNotebook=readCurrentNotebook;');const r=dom.window.readNotebook();assert.equal(r.total,19);assert.equal(r.correct,18);assert.equal(r.wrong,1);assert.equal(r.notebookId,'123');assert.equal(r.title,'Meu caderno');}finally{dom.window.close();}
});


test('topic readings map existing titles, require matching totals and update snapshots without history duplication',async()=>{
 const t=setup();try{await t.send(t.payload());t.choose();t.submit();
 const payload={rows:[{topic:'ICMS',correct:17,wrong:0},{topic:'CONFAZ',correct:1,wrong:1}],readAt:Date.now()};
 assert.equal((await t.send(payload,'notebookTopics')).ok,true);const doc=t.w.document,form=doc.getElementById('tecNotebookTopicsForm'),submit=()=>form.dispatchEvent(new t.w.Event('submit',{cancelable:true}));assert.equal(doc.getElementById('tecNotebookTopicsDestination').value,'');const chooseTopics=()=>{doc.getElementById('tecNotebookTopicsDestination').value='topic';doc.getElementById('tecNotebookTopicsDestination').dispatchEvent(new t.w.Event('change'));};chooseTopics();
 assert.equal(doc.querySelector('[data-tec-topic-row="0"]').value,'topic');assert.equal(doc.querySelector('[data-tec-topic-row="1"]').value,'__new__');submit();assert.match(doc.getElementById('tecNotebookTopicsError').textContent,/confirme/);doc.getElementById('tecNotebookTopicsConfirm').checked=true;const before=structuredClone(t.state().history);submit();assert.deepEqual(t.state().history,before);assert.equal(t.state().questionNotebooks.length,2);assert.equal(t.state().questionNotebooks[0].tecTopicSnapshot.total,17);
 await t.send(payload,'notebookTopics');chooseTopics();assert.notEqual(doc.querySelector('[data-tec-topic-row="1"]').value,'__new__');doc.getElementById('tecNotebookTopicsConfirm').checked=true;submit();assert.equal(t.state().questionNotebooks.length,2);assert.deepEqual(t.state().history,before);
 await t.send({...payload,rows:[{topic:'ICMS',correct:99,wrong:0}]},'notebookTopics');chooseTopics();doc.getElementById('tecNotebookTopicsConfirm').checked=true;submit();assert.match(doc.getElementById('tecNotebookTopicsError').textContent,/99 resolvidas/);assert.deepEqual(t.state().history,before);
 }finally{t.w.close();}
});

test('performance reader uses expanded leaf rows once and excludes hidden rows',()=>{
 const source=readFileSync('integrations/tec-planejamento.user.js','utf8'),start=source.indexOf(' function readPerformanceTopics(){'),end=source.indexOf(" $('readTopics').onclick",start),dom=new JSDOM('<table>'+[[0,'Legislação Federal',11,1],[1,'Leis Complementares',11,1],[2,'CONFAZ',5,1],[2,'Kandir',5,0],[3,'Fato gerador',3,0],[3,'Base de Cálculo',1,0],[3,'Não Cumulatividade',1,0],[2,'Simples',1,0],[3,'Dos Tributos',1,0]].map(([depth,name,correct,wrong])=>'<tr data-depth="'+depth+'"><td><input type="checkbox"> '+name+' </td><td> '+(correct+wrong)+' de '+(correct+wrong)+' </td><td>100% ('+correct+') 0% ('+wrong+')</td></tr>').join('')+'</table>',{url:'https://www.tecconcursos.com.br/estatisticas/desempenho',runScripts:'outside-only'});
 try{const w=dom.window;w.Element.prototype.getClientRects=function(){return [1]};w.Element.prototype.getBoundingClientRect=function(){return {left:Number(this.closest('tr')?.dataset.depth)*16}};w.eval(source.slice(start,end)+';window.readTopics=readPerformanceTopics;');const rows=w.readTopics().rows;assert.deepEqual(Array.from(rows,r=>r.topic),['CONFAZ','Fato gerador','Base de Cálculo','Não Cumulatividade','Dos Tributos']);assert.equal(rows.reduce((n,r)=>n+r.correct+r.wrong,0),12);}finally{dom.window.close();}
});


test('subject headers with simple totals are excluded even when their checkbox positions resemble leaf rows',()=>{
 const source=readFileSync('integrations/tec-planejamento.user.js','utf8'),start=source.indexOf(' function readPerformanceTopics(){'),end=source.indexOf(" $('readTopics').onclick",start),dom=new JSDOM('<table>'+[['Direito Tributário',7,0,true],['IPVA',1,0,false],['ITCMD',4,0,false],['Jurisprudência ICMS',1,0,false],['Jurisprudência ITCMD',1,0,false],['Legislação Tributária Federal',11,1,true],['CONFAZ',5,1,false],['Fato gerador',3,0,false],['Base de Cálculo',1,0,false],['Não Cumulatividade',1,0,false],['Dos Tributos',1,0,false]].map(([name,correct,wrong,subject])=>'<tr><td><input type="checkbox"> '+name+' </td><td> '+(correct+wrong)+(subject?'':' de '+(correct+wrong))+' </td><td>100% ('+correct+') 0% ('+wrong+')</td></tr>').join('')+'</table>',{url:'https://www.tecconcursos.com.br/estatisticas/desempenho',runScripts:'outside-only'});
 try{const w=dom.window;w.Element.prototype.getClientRects=function(){return [1]};w.Element.prototype.getBoundingClientRect=function(){return {left:30}};w.eval(source.slice(start,end)+';window.readTopics=readPerformanceTopics;');const rows=w.readTopics().rows;assert.equal(rows.length,9);assert.equal(rows.reduce((n,r)=>n+r.correct+r.wrong,0),19);assert.equal(rows.reduce((n,r)=>n+r.correct,0),18);assert.equal(rows.reduce((n,r)=>n+r.wrong,0),1);assert.ok(!rows.some(r=>r.topic==='Direito Tributário'||r.topic==='Legislação Tributária Federal'));}finally{dom.window.close();}
});
