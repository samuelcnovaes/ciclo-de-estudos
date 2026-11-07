import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const bridge=readFileSync('src/tec-planner-bridge.js','utf8');
function setup(){
 const dom=new JSDOM('<div class="account-menu"></div><dialog id="focusDialog"></dialog>',{url:'https://samuelcnovaes.github.io/ciclo-de-estudos/',runScripts:'outside-only'}),w=dom.window;w.structuredClone=structuredClone;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let state={ui:{tecIntegrationEnabled:true},activeExamId:'exam',activePlanningId:'plan',subjects:[{id:'a',name:'Direito'}],questionNotebooks:[{id:'topic',subjectId:'a',course:'Meu material',title:'ICMS',topic:'ICMS',kind:'topic',target:null}],history:[{id:'old',kind:'study',subjectId:'a',topic:'ICMS',correct:3,wrong:1,seconds:300,date:'2026-11-05T12:00:00Z',externalSource:{provider:'tec'}},{id:'other',kind:'study',subjectId:'a',correct:2,wrong:0,seconds:60,date:'2026-11-04T12:00:00Z',externalSource:{provider:'tec'}}],stages:[],pom:{work:25}};
 let persist=true;const api={getState:()=>state,setState:s=>{state=s},accountId:'account',uid:()=>w.crypto.randomUUID(),esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),persist:()=>persist,render:()=>{},toast:()=>{},settle:()=>{},sessionStage:()=>({}),stageName:()=>''};w.eval(readFileSync('src/tec-session.js','utf8'));w.eval(readFileSync('src/theory-tracker.js','utf8'));w.eval(bridge);w.CicloTecPlanner.install(api);
 const send=payload=>new Promise(resolve=>{const id=w.crypto.randomUUID(),listener=e=>{const m=JSON.parse(e.detail);if(m.requestId!==id)return;w.document.removeEventListener('ciclo-tec-response',listener);resolve(m)};w.document.addEventListener('ciclo-tec-response',listener);w.document.dispatchEvent(new w.CustomEvent('ciclo-tec-request',{detail:JSON.stringify({channel:'ciclo-tec-v1',direction:'request',requestId:id,type:'notebookHistory',context:{accountId:'account',examId:'exam',planningId:'plan'},payload})}));});
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
 const source=readFileSync('integrations/tec-planejamento.user.js','utf8'),start=source.indexOf(' function readCurrentNotebook(){'),end=source.indexOf(" $('readNotebook').onclick",start),dom=new JSDOM('<a href="/questoes/cadernos/123">Meu caderno</a><div>Questão 57 de 121 <span>(19 Resolvidas, <b>18 Acertos</b> e <b>1 Erros</b>)</span></div><div id="tec-planner-widget">(999 Resolvidas, 999 Acertos e 0 Erros)</div>',{url:'https://www.tecconcursos.com.br/questoes/cadernos/123',runScripts:'outside-only'});
 try{dom.window.eval(source.slice(start,end)+';window.readNotebook=readCurrentNotebook;');const r=dom.window.readNotebook();assert.equal(r.total,19);assert.equal(r.correct,18);assert.equal(r.wrong,1);assert.equal(r.notebookId,'123');assert.equal(r.title,'Meu caderno');}finally{dom.window.close();}
});
