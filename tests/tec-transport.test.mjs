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
 root.getElementById('start').click();await pause();assert.ok(state.session);for(const tick of intervals.get(w))await tick();await pause();tec.window.confirm=()=>false;root.getElementById('cancel').click();await pause();assert.ok(state.session);tec.window.confirm=()=>true;root.getElementById('cancel').click();await pause();assert.equal(state.session,null);assert.equal(values.has('mq1:planner:session'),false);assert.equal(state.history.length,2);assert.equal(values.has('mq1:event:q1'),true);
 }finally{planner.window.close();tec.window.close();}
});

test('panel position width and collapsed clock persist and stay inside the viewport',()=>{
 const values=new Map(),make=()=>{const d=new JSDOM('',{url:'https://www.tecconcursos.com.br/questoes',runScripts:'outside-only'}),w=d.window;w.GM_getValue=(k,f)=>values.has(k)?values.get(k):f;w.GM_setValue=(k,v)=>values.set(k,v);w.GM_deleteValue=k=>values.delete(k);w.GM_listValues=()=>[...values.keys()];w.GM_addValueChangeListener=()=>1;w.setInterval=()=>0;w.eval(script);return d;};
 const d=make(),w=d.window,host=w.document.querySelector('#tec-planner-widget'),root=host.shadowRoot,head=root.querySelector('.head');
 try{head.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(host.style.left,'10px');const range=root.getElementById('panelWidth');range.value='260';range.dispatchEvent(new w.Event('input'));assert.equal(root.querySelector('.box').style.width,'260px');root.getElementById('collapse').click();assert.equal(root.getElementById('miniClock').textContent,'00:00:00');assert.ok(root.querySelector('.box').classList.contains('collapsed'));
 // Pointer dragging works from the title and clamps an off-screen drop.
 const pointer=(type,x,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:1,button:0});head.dispatchEvent(e);};pointer('pointerdown',10,10);pointer('pointermove',-200,-200);pointer('pointerup',-200,-200);assert.equal(host.style.left,'8px');assert.equal(host.style.top,'8px');
 const next=make();try{const h=next.window.document.querySelector('#tec-planner-widget');assert.equal(h.style.left,'8px');assert.equal(h.shadowRoot.querySelector('.box').style.width,'260px');assert.ok(h.shadowRoot.querySelector('.box').classList.contains('collapsed'));h.shadowRoot.getElementById('resetPosition').click();assert.equal(h.style.bottom,'16px');assert.equal(values.has('mq1:planner:position'),false);}finally{next.window.close();}
 }finally{w.close();}
});

test('late planner startup recovers a stale host and missed request notifications without repeated connect clicks',async()=>{
 const planner=new JSDOM('',{url:'https://samuelcnovaes.github.io/ciclo-de-estudos/',runScripts:'outside-only'}),tec=new JSDOM('',{url:'https://www.tecconcursos.com.br/questoes',runScripts:'outside-only'}),values=new Map(),listeners=[],ticks=new Map();
 values.set('mq1:planner:host',{id:'closed-tab',until:Date.now()+6000});values.set('mq1:planner:snapshot',{hostId:'closed-tab',enabled:true,at:Date.now()-7000,context:{accountId:'a',examId:'e',planningId:'p'}});
 for(const d of [planner,tec]){const w=d.window;w.GM_getValue=(k,f)=>values.has(k)?structuredClone(values.get(k)):f;w.GM_setValue=(k,v)=>{values.set(k,structuredClone(v));for(const l of listeners)if(l.k===k&&k!=='mq1:planner:signal')queueMicrotask(()=>l.fn(k,null,v));};w.GM_deleteValue=k=>values.delete(k);w.GM_listValues=()=>[...values.keys()];w.GM_addValueChangeListener=(k,fn)=>listeners.push({k,fn});w.GM_removeValueChangeListener=()=>{};ticks.set(w,[]);w.setInterval=fn=>ticks.get(w).push(fn);}
 const p=planner.window;let starts=0;
 try{p.eval(script);tec.window.eval(script);
 // The native planner listener becomes ready after the first snapshot request.
 p.document.addEventListener('ciclo-tec-request',event=>{const m=JSON.parse(event.detail);if(m.type==='start')starts++;const data={enabled:true,context:{accountId:'a',examId:'e',planningId:'p'},examName:'Prova',planningName:'Plano',timer:m.type==='start'?{sessionId:'session-new',startedAt:Date.now(),elapsed:0,running:true}:null};p.document.dispatchEvent(new p.CustomEvent('ciclo-tec-response',{detail:JSON.stringify({channel:'ciclo-tec-v1',direction:'response',requestId:m.requestId,ok:true,data})}));});
 await new Promise(r=>setTimeout(r,1250));for(const fn of ticks.get(p))await fn();await pause();assert.notEqual(values.get('mq1:planner:snapshot').hostId,'closed-tab');
 const root=tec.window.document.querySelector('#tec-planner-widget').shadowRoot;assert.match(root.getElementById('context').textContent,/Conectado/);let opens=0;tec.window.open=()=>{opens++;return null};root.getElementById('connect').click();assert.equal(opens,0);await pause();
 root.getElementById('start').click();await pause();assert.equal(starts,0);for(const fn of ticks.get(p))await fn();await pause();assert.equal(starts,1);assert.equal(values.get('mq1:planner:session').id,'session-new');for(const fn of ticks.get(p))await fn();await pause();assert.equal(starts,1);
 p.dispatchEvent(new p.Event('pagehide'));assert.equal(values.has('mq1:planner:host'),false);assert.equal(values.has('mq1:planner:snapshot'),false);
 }finally{planner.window.close();tec.window.close();}
});
