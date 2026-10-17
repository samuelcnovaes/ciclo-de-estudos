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
test('blocks a conflicting save and keeps the local draft',async()=>{
 let calls=0;const s=setup(async()=>{calls++;return null;});await s.restore();s.mark({n:7});await s.flush();await s.flush();assert.equal(calls,1);assert.equal(s.blocked,true);assert.equal(s.pending.payload.n,7);
});
test('retains a draft on network failure and retries',async()=>{
 let fails=true;const s=setup(async(p,v)=>{if(fails)throw new Error('offline');return{version:v+1};});await s.restore();s.mark({n:9});await s.flush();assert.equal(s.pending.payload.n,9);fails=false;await s.flush();assert.equal(s.pending,null);
});
test('avoids writes for an unchanged payload',async()=>{
 let calls=0;const s=setup(async()=>{calls++;return{version:2};});await s.restore();s.mark({n:0});await s.flush();assert.equal(calls,0);
});

test('cache failure never blocks a confirmed database write',async()=>{const calls=[];const s=new SnapshotSync({load:async()=>({payload:{n:0},version:1}),write:async(p,v)=>{calls.push(p.n);return{version:v+1}},cache:()=>{throw new Error('quota')},onStatus:()=>{},validate:()=>{}});await s.restore();assert.doesNotThrow(()=>s.mark({n:12}));assert.ok(s.cacheError);await s.flush();assert.deepEqual(calls,[12]);assert.equal(s.pending,null);assert.equal(s.version,2);});
