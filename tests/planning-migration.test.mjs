import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../src/planning-migration.js';
function fixture(){
 let value={activeExamId:'exam',activePlanningId:'a',roundId:'ra',stages:[{id:'stage',subjectId:'subject',mode:'time',target:1800,done:900},{id:'review-stage',subjectId:'subject',mode:'task',target:20,done:5,sourceReviewId:'review'}],plannings:[{id:'a',data:{roundId:'ra',stages:[]}},{id:'b',data:{roundId:'rb',stages:[]}}],history:[{id:'h1',kind:'study',subjectId:'subject',seconds:600,correct:8,wrong:2,roundId:'ra',stageId:'stage',countPlan:true,date:'2026-11-01'},{id:'h2',kind:'study',subjectId:'subject',seconds:300,correct:3,wrong:1,roundId:'ra',stageId:'stage',countPlan:true,date:'2026-11-02'},{id:'partial',kind:'study',planningId:'a',subjectId:'subject',seconds:200,units:5,studyMode:'task',roundId:'ra',stageId:'review-stage',countPlan:true,date:'2026-11-03'}],reviews:[{id:'review',studyId:'h1',status:'scheduled',dueDate:'2026-11-04'},{id:'completed',studyId:'h1',status:'completed',dueDate:'2026-11-02',completionStudyId:'partial'}]};
 let saved,fail=false;const api=globalThis.CicloPlanningMigration.create({getState:()=>value,setState:v=>{value=v},uid:()=> 'moved-stage',persist:()=>{if(fail)return false;saved=structuredClone(value);return true;}});
 const totals=()=>value.history.reduce((n,h)=>[n[0]+h.seconds,n[1]+(h.correct||0),n[2]+(h.wrong||0)],[0,0,0]);
 return {api,state:()=>value,saved:()=>saved,totals,fail:()=>{fail=true}};
}
test('selected history moves statistics once, unlinks source progress and pins reviews left behind',()=>{
 const f=fixture(),before=f.totals(),result=f.api.migrate({kind:'history',source:'a',destination:'b',ids:['h1'],includeReviews:false});
 assert.deepEqual(result,{history:1,reviews:0});assert.deepEqual(f.totals(),before);assert.equal(f.state().history.length,3);
 assert.equal(f.state().history[0].planningId,'b');assert.equal(f.state().history[0].countPlan,false);assert.equal(f.state().history[1].planningId,'a');assert.equal(f.state().stages[0].done,300);
 assert.equal(f.api.reviewOwner(f.state().reviews[0]),'a');assert.equal(f.api.reviewOwner(f.state().reviews[1]),'a');assert.equal(f.state().reviews[1].completionStudyId,'partial');
 assert.equal(f.saved().plannings[0].data.stages[0].done,300);
});
test('review-only transfer keeps study statistics and moves a single remaining stage without duplicates',()=>{
 const f=fixture(),before=f.totals(),result=f.api.migrate({kind:'reviews',source:'a',destination:'b',ids:['review']});
 assert.deepEqual(result,{history:0,reviews:1});assert.deepEqual(f.totals(),before);assert.equal(f.state().history[0].planningId,'a');
 assert.equal(f.state().stages.some(s=>s.sourceReviewId==='review'),false);
 const moved=f.state().plannings[1].data.stages[0];assert.equal(moved.sourceReviewId,'review');assert.equal(moved.target,15);assert.equal(moved.done,0);assert.equal(f.state().history[2].countPlan,false);
 assert.equal(f.state().reviews[0].studyId,'h1');assert.equal(f.state().reviews[0].dueDate,'2026-11-04');assert.equal(f.state().reviews[0].planningId,'b');
 assert.throws(()=>f.api.migrate({kind:'reviews',source:'a',destination:'b',ids:['review']}),/seleção/);
});
test('all history may include linked pending reviews while completed reviews retain ownership',()=>{
 const f=fixture(),before=f.totals();f.api.migrate({kind:'history',source:'a',destination:'b',ids:f.api.rows('history','a').map(r=>r.id),includeReviews:true});
 assert.deepEqual(f.totals(),before);assert.ok(f.state().history.every(h=>h.planningId==='b'));
 assert.equal(f.state().reviews[0].planningId,'b');assert.equal(f.state().reviews[1].planningId,'a');assert.equal(f.state().plannings[1].data.stages[0].target,15);
});
test('migration rollback restores studies, reviews and stage progress if saving fails',()=>{
 const f=fixture(),before=structuredClone(f.state());f.fail();assert.throws(()=>f.api.migrate({kind:'history',source:'a',destination:'b',ids:['h1'],includeReviews:true}),/salvar/);assert.deepEqual(f.state(),before);
});
test('stale data, active timer and same destination are rejected before changing data',()=>{
 const f=fixture(),args={kind:'history',source:'a',destination:'b',ids:['h1'],includeReviews:true};const expected=f.api.fingerprint(args.kind,args.source,args.destination,args.ids,args.includeReviews);
 f.state().history[0].seconds=700;assert.throws(()=>f.api.migrate({...args,expected}),/mudaram/);
 f.state().session={};assert.throws(()=>f.api.migrate(args),/cronômetro/);delete f.state().session;assert.throws(()=>f.api.migrate({...args,destination:'a'}),/diferente/);
});
test('unassigned reviews stay unassigned when their source history moves alone',()=>{
 const f=fixture();f.state().history=[{id:'loose',kind:'study',seconds:60}];f.state().reviews=[{id:'loose-review',studyId:'loose',status:'scheduled'}];f.state().stages=[];
 f.api.migrate({kind:'history',source:'',destination:'b',ids:['loose'],includeReviews:false});assert.equal(f.api.reviewOwner(f.state().reviews[0]),'');assert.equal(f.api.historyOwner(f.state().history[0]),'b');
});
