import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const source=readFileSync('src/theory-tracker.js','utf8');
const ongoing=source.split('\n').find(l=>l.includes('function ongoingQuestionMaterials('));
const open=source.split('\n').find(l=>l.includes('function openQuestionMaterial('));
function setup(books){const state={activeExamId:'exam',questionNotebooks:books};const context={S:()=>state,notebooks:()=>state.questionNotebooks,questionBookStatus:b=>b.status,questionMaterialTotals:(subjectId,course)=>({total:books.filter(b=>b.subjectId===subjectId&&b.course===course).reduce((n,b)=>n+(b.total||0),0)}),Set,Map};runInNewContext(ongoing+';this.ongoing=ongoingQuestionMaterials;',context);return {state,context};}
test('ongoing materials match the subject and exclude completed or untouched notebooks',()=>{
 const books=[{id:'a',subjectId:'s',course:'Em estudo',status:'active',total:2},{id:'b',subjectId:'s',course:'Em estudo',status:'pending'},{id:'c',subjectId:'s',course:'Finalizado',status:'completed',total:10},{id:'d',subjectId:'s',course:'Novo',status:'pending'},{id:'e',subjectId:'other',course:'Outra matéria',status:'active',total:5}];
 const {context}=setup(books);const result=context.ongoing('s');assert.equal(result.length,1);assert.equal(result[0].course,'Em estudo');assert.equal(context.ongoing('unknown').length,0);
 books[0].status='completed';books[1].status='completed';assert.equal(context.ongoing('s').length,0);
});
test('multiple ongoing materials and imported notebook totals are supported',()=>{
 const {context}=setup([{id:'a',subjectId:'s',course:'TEC 1',status:'active',total:2},{id:'b',subjectId:'s',course:'TEC 2',status:'pending',total:12}]);assert.equal(context.ongoing('s').length,2);
});
test('opening a material clears old filters and expands the destination in the active exam',()=>{
 const {context}=setup([{id:'a',subjectId:'s',course:'TEC',status:'active',total:1}]);let rendered=0,scrolled=0;
 Object.assign(context,{render:()=>rendered++,$:()=>({querySelectorAll:()=>[{dataset:{questionCourse:JSON.stringify(['s','TEC'])},scrollIntoView:()=>scrolled++}]}),questionOpenSubjects:new Set(),questionOpenCourses:new Set()});
 runInNewContext("let questionExam='',learningView='hub',questionSubject='',questionSearch='old',questionStatusFilter='completed';"+open+";this.open=openQuestionMaterial;this.filters=()=>({questionExam,learningView,questionSubject,questionSearch,questionStatusFilter});",context);
 assert.equal(context.open('s','TEC'),true);assert.equal(rendered,1);assert.equal(scrolled,1);assert.deepEqual(JSON.parse(JSON.stringify(context.filters())),{questionExam:'exam',learningView:'questions',questionSubject:'s',questionSearch:'',questionStatusFilter:'all'});assert.ok(context.questionOpenCourses.has(JSON.stringify(['s','TEC'])));assert.equal(context.open('other','TEC'),false);
});
test('all inline application scripts remain syntactically valid',()=>{
 const index=readFileSync('index.html','utf8');for(const match of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(match[0].startsWith('<script type="application/json"'))continue;new Script(match[1]);}
});
