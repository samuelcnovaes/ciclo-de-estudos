import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const pause=()=>new Promise(r=>setTimeout(r,30));
const script=readFileSync('integrations/tec-planejamento.user.js','utf8').split('/* TEC PLANNER BRIDGE START */')[1].split('/* TEC PLANNER BRIDGE END */')[0];
test('DOM transport connects without window messages across an isolated userscript and preserves random-topic sessions',async()=>{
 const planner=new JSDOM('<div class="account-menu"></div><dialog id="focusDialog"></dialog>',{url:'https://samuelcnovaes.github.io/ciclo-de-estudos/',runScripts:'outside-only'}),tec=new JSDOM('',{url:'https://www.tecconcursos.com.br/questoes',runScripts:'outside-only'});
 const values=new Map(),listeners=new Map(),intervals=new Map();let lid=0;
 for(const dom of [planner,tec]){const w=dom.window;w.structuredClone=structuredClone;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.GM_getValue=(k,f)=>values.has(k)?structuredClone(values.get(k)):f;w.GM_setValue=(k,v)=>{const old=values.get(k);values.set(k,structuredClone(v));for(const [_,listener] of listeners)if(listener.k===k)queueMicrotask(()=>listener.fn(k,old,v,true));};w.GM_listValues=()=>[...values.keys()];w.GM_deleteValue=k=>values.delete(k);w.GM_addValueChangeListener=(k,fn)=>{listeners.set(++lid,{k,fn});return lid;};w.GM_removeValueChangeListener=id=>listeners.delete(id);const ticks=[];intervals.set(w,ticks);w.setInterval=fn=>{ticks.push(fn);return ticks.length;};w.postMessage=()=>{};}
 const w=planner.window;w.eval(readFileSync('src/tec-session.js','utf8'));w.eval(readFileSync('src/tec-planner-bridge.js','utf8'));
 let state={ui:{tecIntegrationEnabled:true},activeExamId:'exam',activePlanningId:'plan',subjects:[],stages:[],history:[],pom:{work:25}};
 const api={getState:()=>state,setState:s=>{state=s},accountId:'account',uid:()=>w.crypto.randomUUID(),esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),settle:()=>{},sessionStage:()=>({}),stageName:()=>'',isTask:s=>s?.mode==='task',activityKey:s=>s?.toLowerCase(),persist:()=>true,render:()=>{},updateTimer:()=>{},rememberTopic:()=>{},applyRecord:()=>{},time:s=>String(s),toast:()=>{}};
 w.CicloTecPlanner.install(api);w.eval(script);await pause();tec.window.eval(script);await pause();const root=tec.window.document.querySelector('#tec-planner-widget').shadowRoot;
 try{
 root.getElementById('start').click();await pause();assert.ok(state.session.tec);const id=state.session.tec.id;state.session.elapsed=120;
 for(const [n,subject,topic,correct] of [[1,'Direito','Impostos',1],[2,'Auditoria','Evidência',0],[3,'Direito','Impostos',0]]){const eventId='q'+n;values.set('mq1:event:'+eventId,{id:eventId,ts:Date.now(),correct,wrong:1-correct});if(n!==3)values.set('mq1:topicEvent:'+eventId,{topic:{subject,name:topic}});}
 for(const tick of intervals.get(w))await tick();for(const tick of intervals.get(tec.window))await tick();await pause();assert.equal(state.session.tec.events.length,3);assert.match(state.session.tec.events[2].topic,/não identificado/);
 values.set('mq1:topicEvent:q3',{topic:{subject:'Direito',name:'Impostos'}});for(const tick of intervals.get(tec.window))await tick();await pause();assert.equal(state.session.tec.events.filter(e=>e.topic==='Impostos').length,2);
 root.getElementById('pause').click();await pause();assert.equal(state.session.running,false);for(const tick of intervals.get(w))await tick();await pause();root.getElementById('pause').click();await pause();assert.equal(state.session.running,true);
 state.session=null;for(const tick of intervals.get(w))await tick();await pause();assert.equal(root.getElementById('recover').hidden,false);root.getElementById('recover').click();await pause();assert.equal(state.session.tec.id,id);assert.equal(state.session.elapsed,120);assert.equal(state.session.running,false);assert.equal(state.session.tec.events.length,3);
 root.getElementById('finish').click();await new Promise(r=>setTimeout(r,1000));assert.equal(w.document.getElementById('tecBatchDialog').open,true);assert.equal(w.document.querySelectorAll('.tec-batch-row').length,2);w.document.getElementById('tecBatchForm').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(state.history.length,2);assert.equal(state.history.reduce((n,h)=>n+h.correct+h.wrong,0),3);assert.equal(state.history.reduce((n,h)=>n+h.seconds,0),120);assert.equal(state.session,null);
 for(const tick of intervals.get(w))await tick();await pause();for(const tick of intervals.get(tec.window))await tick();assert.equal(values.get('mq1:planner:session').saved,true);assert.equal(state.ui.tecImportedSessions[0].id,id);
 }finally{planner.window.close();tec.window.close();}
});
