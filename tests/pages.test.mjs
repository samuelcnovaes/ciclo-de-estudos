import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('index.html','utf8');
async function boot(user){
 const dom=new JSDOM(html,{url:'https://samuelcnovaes.github.io/ciclo-de-estudos/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.structuredClone=structuredClone;w.setInterval=()=>0;w.setTimeout=()=>0;w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.CicloCloud={prepare:async()=>({user,key:user?'ciclo-estudos-v1:cloud:'+user.id:undefined,mode:user?'cloud':'local'}),attach:()=>{}};
 const scripts=w.document.querySelectorAll('script:not([src]):not([type="application/json"])');for(const s of scripts)w.eval(s.textContent);
 await new Promise(r=>setTimeout(r,25));return dom;
}
test('requires cloud login and does not initialize personal data before login',async()=>{const d=await boot(null);assert.equal(d.window.document.body.classList.contains('login-required'),true);assert.equal(d.window.document.getElementById('cloudDialog').open,true);assert.equal(d.window.localStorage.length,0);d.window.close();});
test('new authenticated account gets empty studies',async()=>{const d=await boot({id:'new-user',email:'user@example.invalid'});assert.ok(d.window.document.getElementById('content').textContent.includes('Cadastre suas matérias'));const data=JSON.parse(d.window.localStorage.getItem('ciclo-estudos-v1:cloud:new-user'));assert.equal(data.subjects.length,0);assert.equal(data.stages.length,0);assert.equal(data.history.length,0);d.window.close();});
test('assets are relative and performance opens a separate tab',()=>{const d=new JSDOM(html);for(const el of d.window.document.querySelectorAll('script[src]'))assert.ok(el.getAttribute('src').startsWith('./'));assert.equal(d.window.document.querySelector('.performance-link').target,'_blank');assert.ok(!html.includes('PHOTO_PROGRESS'));assert.ok(!html.includes('ACCOUNT_CONTEXT_JSON'));d.window.close();});

test('empty home opens registration and successful batch navigates to cycle',async()=>{const d=await boot({id:'empty'}),w=d.window;w.document.getElementById('homeRegisterSubjects').click();assert.equal(w.document.getElementById('batchSubjectDialog').open,true);w.document.getElementById('batchSubjectNames').value='Direito Tributário\nContabilidade';w.document.getElementById('batchSubjectForm').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(w.document.getElementById('batchSubjectDialog').open,false);assert.match(w.document.getElementById('content').textContent,/Etapas do ciclo/);assert.equal(w.document.querySelector('[data-tab="cycle"]').classList.contains('active'),true);const data=JSON.parse(w.localStorage.getItem('ciclo-estudos-v1:cloud:empty'));assert.equal(data.subjects.length,2);w.document.querySelector('[data-tab="home"]').click();assert.match(w.document.getElementById('content').textContent,/Constância/);assert.equal(w.document.getElementById('homeRegisterSubjects'),null);w.close();});
