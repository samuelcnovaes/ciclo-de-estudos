import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const script=readFileSync('integrations/tec-planejamento.user.js','utf8');
const metadata=script.split('/* TEC BANK METADATA START */')[1].split('/* TEC BANK METADATA END */')[0];
function boot(html='',values=new Map(),full=false){
 const dom=new JSDOM(html,{url:'https://www.tecconcursos.com.br/questoes/cadernos/123',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,ticks=[];
 w.GM_getValue=(k,f)=>values.has(k)?values.get(k):f;w.GM_setValue=(k,v)=>values.set(k,v);w.GM_listValues=()=>[...values.keys()];w.GM_deleteValue=k=>values.delete(k);w.GM_addValueChangeListener=()=>1;w.GM_removeValueChangeListener=()=>{};w.setInterval=f=>{ticks.push(f);return 0;};
 w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}];};
 w.eval(full?script:metadata);return {dom,w,ticks,values};
}
test('bank comes only from the current question metadata, including unknown and CESPE aliases',()=>{
 const {w}=boot('<div class="questao"><div class="questao-cabecalho"><a class="id-questao">#2669285</a> CESGRANRIO - 2015 - Profissional Júnior</div><div class="questao-enunciado">FGV - 2020</div></div>');
 try{const api=w.CicloTecBank,q=w.document.querySelector('.questao');assert.equal(api.read(q),'CESGRANRIO');q.querySelector('.questao-cabecalho').innerHTML='<a href="/bancas/1">CESPE / CEBRASPE</a>';assert.equal(api.read(q),'CEBRASPE');q.querySelector('.questao-cabecalho').remove();assert.equal(api.read(q),'Banca não identificada');assert.equal(api.matches({bank:'FGV'}),true);w.GM_setValue('mq1:bankFilter','FCC');assert.equal(api.matches({bank:'FGV'}),false);assert.equal(api.matches({bank:'FCC'}),true);assert.equal(api.matches({}),false);}finally{w.close();}
});
test('TURBO filters daily weekly and topic results while Geral preserves old unclassified data',async()=>{
 const now=new Date(),day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-'),values=new Map();
 for(const [i,bank,correct] of [[1,'CESGRANRIO',1],[2,'FGV',0],[3,undefined,1]]){const id='q'+i;values.set('mq1:event:'+id,{id,bank,day,total:1,correct,wrong:1-correct,ts:Date.now()});values.set('mq1:topicEvent:'+id,{id,day,topic:{key:'t',name:'DMPL',subject:'Contabilidade'}});}
 values.set('mq1:activeTopic',{key:'t',name:'DMPL',subject:'Contabilidade'});
 const {w,ticks}=boot('<div class="questao"><div class="questao-cabecalho">#123 CESGRANRIO - 2015 - Cargo</div></div>',values,true);
 try{const host=[...w.document.documentElement.children].find(e=>e.shadowRoot?.getElementById('turbo-theme')),root=host.shadowRoot,select=root.getElementById('turbo-bank-filter');assert.ok(select);assert.match(select.textContent,/Geral — todas as bancas/);assert.equal(root.getElementById('total').textContent,'3');assert.match(root.getElementById('turbo-current-bank').textContent,/CESGRANRIO/);
 select.value='FGV';select.dispatchEvent(new w.Event('change'));for(const tick of ticks)await tick();assert.equal(root.getElementById('total').textContent,'1');assert.equal(root.getElementById('turbo-week-done').textContent,'1');assert.equal(root.getElementById('turbo-hits').textContent,'0');assert.equal(root.getElementById('turbo-errors').textContent,'1');assert.match(root.getElementById('topic-total-errors').textContent,/1/);assert.match(root.getElementById('topic-total-hits').textContent,/0/);
 select.value='';select.dispatchEvent(new w.Event('change'));for(const tick of ticks)await tick();assert.equal(root.getElementById('total').textContent,'3');assert.equal(values.size>=6,true);
 }finally{w.close();}
});
test('automatic answer retains the bank captured when submitting and ignores later header changes',async()=>{
 const {w,ticks,values}=boot('<div class="questao"><div class="questao-cabecalho"><a class="id-questao" href="/questoes/2669285">#2669285</a> CESGRANRIO - 2015 - Cargo</div><button class="botao-resolver">Resolver</button></div>',new Map(),true);
 try{const q=w.document.querySelector('.questao');q.querySelector('button').click();q.querySelector('.questao-cabecalho').innerHTML='<a class="id-questao" href="/questoes/2669285">#2669285</a> FGV - 2020 - Cargo';const result=w.document.createElement('div');result.className='questao-enunciado-resolucao-acertou';q.append(result);for(const tick of ticks)await tick();const events=[...values.entries()].filter(([k])=>k.startsWith('mq1:event:'));assert.equal(events.length,1);assert.equal(events[0][1].bank,'CESGRANRIO');for(const tick of ticks)await tick();assert.equal([...values.keys()].filter(k=>k.startsWith('mq1:event:')).length,1);}finally{w.close();}
});
test('mixed-bank sessions retain separate results and exact total time without duplicating attempts',()=>{
 const {w}=boot();try{w.eval(readFileSync('src/tec-session.js','utf8'));const rows=[['a','FGV',1,20],['b','CESGRANRIO',0,45],['c',null,1,60]].map(([id,bank,correct,elapsed])=>({id,bank,subject:'Contabilidade',topic:'DMPL',correct,wrong:1-correct,elapsed})),g=w.CicloTecSession.groups([...rows,rows[0]],61);assert.equal(g.length,3);assert.equal(g.reduce((n,r)=>n+r.seconds,0),61);assert.equal(g.reduce((n,r)=>n+r.correct+r.wrong,0),3);assert.equal(g[2].bank,'Banca não identificada');}finally{w.close();}
});
