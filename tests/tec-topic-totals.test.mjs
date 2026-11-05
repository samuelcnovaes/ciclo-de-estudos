import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync('integrations/tec-planejamento.user.js','utf8');
test('topic totals include previous days and manual entries, excluding voided responses and other topics',()=>{
 const values=new Map(),P='mq1:',today='2026-11-05';
 for(const [id,date,topic,total,correct,wrong,voided] of [['old','2026-11-04','a',3,2,1,false],['manual',today,'a',5,3,2,false],['void',today,'a',8,8,0,true],['other',today,'b',10,9,1,false]]){
  values.set(P+'topicEvent:'+id,{id,day:date,topic:{key:topic}});values.set(P+'event:'+id,{id,total,correct,wrong});if(voided)values.set(P+'void:'+id,true);
 }
 values.set(P+'topicEvent:missing',{id:'missing',day:today,topic:{key:'a'}});
 const tally=script.slice(script.indexOf('  function tally(topic)'),script.indexOf('  function update() {',script.indexOf('  function tally(topic)')));
 const counts=runInNewContext(tally+';tally({key:"a"})',{P,day:()=>today,GM_listValues:()=>[...values.keys()],GM_getValue:(key,fallback)=>values.get(key)??fallback});
 assert.equal(counts.total,8);assert.equal(counts.correctTotal,5);assert.equal(counts.wrongTotal,3);assert.equal(counts.today,5);assert.equal(counts.correctToday,3);assert.equal(counts.wrongToday,2);
 const nodes=Object.fromEntries(['topic-total-hits','topic-total-errors','topic-today-hits','topic-today-errors'].map(id=>[id,{textContent:''}]));
 const render=script.slice(script.indexOf("    $('topic-total-hits').textContent"),script.indexOf('    const total = counts.today;',script.indexOf("    $('topic-total-hits').textContent")));
 runInNewContext(render,{counts,topic:{key:'a'},$:id=>nodes[id]});assert.equal(nodes['topic-total-hits'].textContent,'Acertos: 5');assert.equal(nodes['topic-total-errors'].textContent,'Erros: 3');assert.equal(nodes['topic-today-hits'].textContent,'Acertos: 3');assert.equal(nodes['topic-today-errors'].textContent,'Erros: 2');
 runInNewContext(render,{counts,topic:null,$:id=>nodes[id]});assert.equal(nodes['topic-total-hits'].textContent,'Acertos: —');assert.equal(nodes['topic-total-errors'].textContent,'Erros: —');
});
