import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SnapshotSync} from '../src/snapshot-sync.js';
const setup=write=>new SnapshotSync({load:async()=>({payload:{n:0},version:1}),write,validate:()=>{},cache:()=>{},onStatus:()=>{}});
test('serializes edits made during a save and advances the version',async()=>{
 let release;const gate=new Promise(r=>release=r);const calls=[];
 const s=setup(async(p,v)=>{calls.push([p.n,v]);if(calls.length===1)await gate;return{version:v+1};});
 await s.restore();s.mark({n:1});const first=s.flush();s.mark({n:2});const second=s.flush();release();await Promise.all([first,second]);
 assert.deepEqual(calls,[[1,1],[2,2]]);assert.equal(s.pending,null);assert.equal(s.version,3);
});
test('retries a stale version by merging against the confirmed common baseline',async()=>{
 let row={payload:{n:0,name:'Original'},version:1};const s=new SnapshotSync({load:async()=>structuredClone(row),write:async(p,v)=>{if(v!==row.version)return null;row={payload:p,version:v+1};return row},validate:()=>{},cache:()=>{},onStatus:()=>{}});await s.restore();row={payload:{n:0,name:'Outro dispositivo'},version:2};s.mark({n:7,name:'Original'});await s.flush();assert.equal(s.blocked,false);assert.equal(s.pending,null);assert.deepEqual(row.payload,{n:7,name:'Outro dispositivo'});
});
test('retains a draft on network failure and retries',async()=>{
 let fails=true;const s=setup(async(p,v)=>{if(fails)throw new Error('offline');return{version:v+1};});await s.restore();s.mark({n:9});await s.flush();assert.equal(s.pending.payload.n,9);fails=false;await s.flush();assert.equal(s.pending,null);
});
test('avoids writes for an unchanged payload',async()=>{
 let calls=0;const s=setup(async()=>{calls++;return{version:2};});await s.restore();s.mark({n:0});await s.flush();assert.equal(calls,0);
});

test('cache failure never blocks a confirmed database write',async()=>{const calls=[];const s=new SnapshotSync({load:async()=>({payload:{n:0},version:1}),write:async(p,v)=>{calls.push(p.n);return{version:v+1}},cache:()=>{throw new Error('quota')},onStatus:()=>{},validate:()=>{}});await s.restore();assert.doesNotThrow(()=>s.mark({n:12}));assert.ok(s.cacheError);await s.flush();assert.deepEqual(calls,[12]);assert.equal(s.pending,null);assert.equal(s.version,2);});

function pair(payload){let row={payload:structuredClone(payload),version:1};const make=onRemote=>new SnapshotSync({load:async()=>structuredClone(row),write:async(p,v)=>{if(v!==row.version)return null;row={payload:structuredClone(p),version:v+1};return{version:row.version}},cache:()=>{},validate:()=>{},onStatus:()=>{},onRemote});return{make,get:()=>row};}
test('two devices add study records and topic changes without losing either update',async()=>{const base={subjects:[{id:'a',name:'Direito'}],stages:[{id:'s',subjectId:'a',done:0}],history:[],edital:{subjects:[{id:'e',subjectId:'a',topics:[{id:'t',done:false}]}]}},server=pair(base),a=server.make(),b=server.make();await a.restore();await b.restore();const one=structuredClone(base);one.history.push({id:'h1',kind:'study',stageId:'s',seconds:600});one.stages[0].done=600;one.edital.subjects[0].topics[0].done=true;a.mark(one);await a.flush();const two=structuredClone(base);two.history.push({id:'h2',kind:'study',stageId:'s',seconds:600});two.stages[0].done=600;b.mark(two);await b.flush();assert.equal(server.get().payload.history.length,2);assert.equal(server.get().payload.stages[0].done,1200);assert.equal(server.get().payload.edital.subjects[0].topics[0].done,true);assert.equal(b.blocked,false);});
test('idle device refreshes remote changes before its next edit',async()=>{const server=pair({n:0,name:'A'}),a=server.make();let current={n:0,name:'A'};const b=server.make(next=>{current=next});await a.restore();await b.restore();a.mark({n:1,name:'A'});await a.flush();await b.refresh();assert.equal(current.n,1);b.mark({...current,name:'B'});await b.flush();assert.deepEqual(server.get().payload,{n:1,name:'B'});});
test('simultaneous edits to the same field retain the other value in recoverable differences',async()=>{const server=pair({n:0}),a=server.make(),b=server.make();await a.restore();await b.restore();a.mark({n:1});await a.flush();b.mark({n:2});await b.flush();assert.equal(server.get().payload.n,2);assert.ok(server.get().payload.syncRecovery.some(entry=>entry.path==='n'&&entry.value===1));assert.equal(b.blocked,false);});

test('compact baseline patch restores the exact common snapshot without duplicating a large plan',()=>{const base={stages:Array.from({length:1000},(_,i)=>({id:String(i),done:0,target:3600})),history:[],oldField:true},pending=structuredClone(base);pending.stages[20].done=600;pending.history.push({id:'new',seconds:600});delete pending.oldField;pending.newField='new';const patch=SnapshotSync.createPatch(pending,base);assert.ok(JSON.stringify(patch).length<1000);assert.deepEqual(SnapshotSync.applyPatch(pending,patch),base);});
