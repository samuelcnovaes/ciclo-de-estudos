import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
test('a bound FGV stage never receives CESGRANRIO or unclassified results from a mixed TEC session',async()=>{
 const dom=new JSDOM('<div class="account-menu"></div><dialog id="focusDialog"></dialog>',{url:'https://samuelcnovaes.github.io/ciclo-de-estudos/',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let state={ui:{tecIntegrationEnabled:true},activeExamId:'exam',activePlanningId:'plan',roundId:'round',subjects:[{id:'a',name:'Direito'}],questionNotebooks:[],history:[],stages:['FGV','CESGRANRIO'].map(bank=>({id:bank,bank,subjectId:'a',content:'Questões',topic:'ICMS',mode:'task',unit:'questões',target:10,done:0})),session:{stageId:'FGV',elapsed:90,running:false,tec:{id:'session',startedAt:Date.now(),planningStageId:'FGV',events:[]}}};
 const api={getState:()=>state,setState:s=>state=s,accountId:'account',uid:()=>w.crypto.randomUUID(),esc:v=>String(v||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),settle:()=>{},sessionStage:()=>state.stages[0],stageName:s=>s?.bank||'',isTask:s=>s?.mode==='task',activityKey:s=>s?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),persist:()=>true,render:()=>{},updateTimer:()=>{},rememberTopic:()=>{},applyRecord:()=>{},time:String,toast:()=>{}};
 try{w.eval(readFileSync('src/tec-session.js','utf8'));w.eval(readFileSync('src/tec-planner-bridge.js','utf8'));w.CicloTecPlanner.install(api);
 const requestId='request',reply=new Promise(resolve=>w.document.addEventListener('ciclo-tec-response',e=>{const m=JSON.parse(e.detail);if(m.requestId===requestId)resolve(m);},{once:true}));
 const events=['FGV','CESGRANRIO',undefined].map((bank,i)=>({id:'q'+i,bank,subject:'Direito',topic:'ICMS',correct:1,wrong:0,elapsed:(i+1)*30}));
 w.document.dispatchEvent(new w.CustomEvent('ciclo-tec-request',{detail:JSON.stringify({channel:'ciclo-tec-v1',direction:'request',requestId,type:'finish',sessionId:'session',context:{accountId:'account',examId:'exam',planningId:'plan'},payload:{events}})}));assert.equal((await reply).ok,true);
 const cards=w.document.querySelectorAll('.tec-batch-row');assert.equal(cards.length,3);assert.equal(cards[0].querySelector('[data-tec-field="stage"]').value,'FGV');assert.equal(cards[1].querySelector('[data-tec-field="stage"]').value,'CESGRANRIO');assert.equal(cards[2].querySelector('[data-tec-field="stage"]').value,'');
 w.document.getElementById('tecBatchForm').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(state.history.length,3);assert.equal(state.history[0].stageId,'FGV');assert.equal(state.history[1].stageId,'CESGRANRIO');assert.equal(state.history[2].countPlan,false);assert.equal(state.history.reduce((n,h)=>n+h.seconds,0),90);
 }finally{w.close();}
});
