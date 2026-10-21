/* Optional userscript bridge. Runs inside the signed-in planner; never exports credentials. */
(function(root){
 'use strict';
 root.CicloTecPlanner={install(api){
  const $=id=>document.getElementById(id),S=()=>api.getState(),C=root.CicloTecSession,esc=api.esc,channel='ciclo-tec-v1';
  let draft=null;const handled=new Map();
  const context=()=>({accountId:api.accountId,examId:S().activeExamId||'',planningId:S().activePlanningId||''});
  const enabled=()=>!!S().ui?.tecIntegrationEnabled;
  const same=b=>b&&Object.entries(context()).every(([k,v])=>b[k]===v);
  const receipt=id=>S().ui?.tecImportedSessions?.some(r=>r.id===id);
  const timer=()=>{const se=S().session;if(!se)return null;api.settle();return {sessionId:se.tec?.id||null,startedAt:se.tec?.startedAt||null,elapsed:Math.floor(se.elapsed),running:!!se.running,mode:se.mode,phase:se.phase,phaseLeft:Math.ceil(se.phaseLeft||0),label:se.tec?'Sessão com tópicos aleatórios':api.stageName(api.sessionStage(se))};};
  function snapshot(){return enabled()?{enabled:true,context:context(),examName:S().exams?.find(e=>e.id===S().activeExamId)?.name||'Meus estudos',planningName:S().plannings?.find(p=>p.id===S().activePlanningId)?.name||'Sem planejamento ativo',timer:timer(),receipts:(S().ui?.tecImportedSessions||[]).slice(-20).map(r=>r.id)}:{enabled:false};}
  const dialog=document.createElement('dialog');dialog.id='tecIntegrationDialog';dialog.innerHTML='<div class="dialog-head"><h2>TEC e Planejamento</h2><button type="button" data-close="tecIntegrationDialog" aria-label="Fechar integração">×</button></div><p>Use a versão integrada do script no mesmo navegador. Mantenha esta aba aberta para sincronizar o cronômetro.</p><p>A sessão pode reunir várias matérias e tópicos. Nenhuma senha ou credencial é compartilhada com o TEC.</p><p id="tecIntegrationStatus" role="status"></p><div class="dialog-actions"><button type="button" id="tecDisable">Desativar</button><button type="button" class="primary" id="tecEnable">Ativar integração neste navegador</button></div>';document.body.append(dialog);
  const review=document.createElement('dialog');review.id='tecBatchDialog';review.innerHTML='<div class="dialog-head"><div><span class="eyebrow">SESSÃO DO TEC</span><h2>Conferir registro por tópicos</h2></div><button type="button" data-close="tecBatchDialog" aria-label="Fechar conferência">×</button></div><p>Acertos e erros vêm das respostas detectadas. O tempo por tópico é uma estimativa pelo intervalo entre respostas e inclui a leitura de comentários; ajuste se necessário. O total deve permanecer igual ao cronômetro.</p><p id="tecBatchTotals" role="status"></p><form id="tecBatchForm"><div id="tecBatchRows"></div><label for="tecBatchComments">Observações da sessão</label><textarea id="tecBatchComments" rows="2"></textarea><p id="tecBatchError" class="form-error" role="alert" hidden></p><div class="dialog-actions"><button type="button" data-close="tecBatchDialog">Voltar sem salvar</button><button class="primary" id="tecBatchSave">Salvar registros no Planejamento</button></div></form>';document.body.append(review);
  const button=document.createElement('button');button.id='connectTec';button.type='button';button.textContent='TEC';button.title='Integrar o TEC ao Planejamento';button.onclick=()=>{$('tecIntegrationStatus').textContent=enabled()?'Integração ativada. Abra o TEC com o script instalado.':'Integração desativada.';dialog.showModal();};document.querySelector('.account-menu')?.append(button);
  $('tecEnable').onclick=()=>{S().ui??={};S().ui.tecIntegrationEnabled=true;api.persist();$('tecIntegrationStatus').textContent='Ativada. No TEC, clique em Conectar ao Planejamento.';};
  $('tecDisable').onclick=()=>{S().ui.tecIntegrationEnabled=false;api.persist();$('tecIntegrationStatus').textContent='Desativada. O cronômetro e os registros existentes foram preservados.';};
  function candidates(subjectId,topic){return S().stages.filter(st=>st.subjectId===subjectId&&api.activityKey(st.content)==='questoes'&&(!api.isTask(st)||st.unit==='questões')).map(st=>({stage:st,exact:C.key(st.curriculum?.topicName||st.topic)===C.key(topic),generic:!st.curriculum?.topicName&&!st.topic}));}
  function stageOptions(row,subjectId,current){const matches=candidates(subjectId,row.topic);return '<option value="">Somente histórico · não contabilizar em etapa</option>'+matches.map(({stage:st})=>'<option value="'+esc(st.id)+'" '+(st.id===current?'selected':'')+'>'+esc(api.stageName(st))+'</option>').join('');}
  function readRows(){return [...$('tecBatchRows').children].map((card,i)=>{const val=name=>card.querySelector('[data-tec-field="'+name+'"]').value;return {...draft.groups[i],subjectId:val('subject'),topic:val('topic').trim(),stageId:val('stage'),correct:Number(val('correct')),wrong:Number(val('wrong')),seconds:Number(val('hours'))*3600+Number(val('minutes'))*60+Number(val('seconds'))};});}
  function summary(){if(!draft)return;const rows=readRows(),seconds=rows.reduce((n,r)=>n+r.seconds,0),questions=rows.reduce((n,r)=>n+r.correct+r.wrong,0);$('tecBatchTotals').textContent=rows.length+' tópicos · '+questions+' questões · tempo distribuído: '+api.time(seconds)+' / '+api.time(draft.totalSeconds);}
  function showReview(){
   const se=S().session;if(!se?.tec)throw Error('Inicie ou vincule uma sessão no TEC primeiro.');
   if(receipt(se.tec.id))return {status:'saved',sessionId:se.tec.id};
   if(review.open&&draft?.sessionId===se.tec.id)return {status:'review',sessionId:se.tec.id};
   api.settle();se.running=false;api.persist();api.updateTimer();$('focusDialog').close();
   const totalSeconds=Math.floor(se.elapsed),groups=C.groups(se.tec.events||[],totalSeconds);if(!groups.length)throw Error('Nenhuma questão detectada nesta sessão. Resolva uma questão antes de salvar.');
   draft={sessionId:se.tec.id,context:context(),groups,totalSeconds};$('tecBatchComments').value='';$('tecBatchError').hidden=true;
   $('tecBatchRows').innerHTML=groups.map((row,i)=>{
    const m=S().subjects.find(m=>C.key(m.name)===C.key(row.subject)),matches=m?candidates(m.id,row.topic):[],exact=matches.filter(x=>x.exact),generic=matches.filter(x=>x.generic),choice=exact.length===1?exact[0].stage.id:!exact.length&&generic.length===1?generic[0].stage.id:'';
    return '<section class="tec-batch-row"><h3>'+esc(row.subject)+' · '+esc(row.topic)+'</h3><div class="tec-batch-fields"><label>Matéria no Planejamento<select data-tec-field="subject"><option value="__new__">Cadastrar: '+esc(row.subject)+'</option>'+S().subjects.map(x=>'<option value="'+esc(x.id)+'" '+(m?.id===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label><label>Tópico<input data-tec-field="topic" maxlength="1000" value="'+esc(row.topic)+'" required></label><label>Etapa correspondente<select data-tec-field="stage">'+stageOptions(row,m?.id,choice)+'</select></label><div class="tec-batch-results"><label>Acertos<input data-tec-field="correct" type="number" min="0" max="1000000" step="1" value="'+row.correct+'" required></label><label>Erros<input data-tec-field="wrong" type="number" min="0" max="1000000" step="1" value="'+row.wrong+'" required></label></div><div><span>Tempo estimado · ajustável</span><div class="tec-batch-duration">'+[['hours','Horas',Math.floor(row.seconds/3600),168],['minutes','Minutos',Math.floor(row.seconds%3600/60),59],['seconds','Segundos',row.seconds%60,59]].map(([field,label,value,max])=>'<label>'+label+'<input data-tec-field="'+field+'" type="number" min="0" max="'+max+'" step="1" value="'+value+'" required></label>').join('')+'</div></div></div></section>';
   }).join('');summary();review.showModal();return {status:'review',sessionId:se.tec.id};
  }
  $('tecBatchForm').addEventListener('input',summary);$('tecBatchRows').addEventListener('change',event=>{const card=event.target.closest('.tec-batch-row');if(!card)return;const i=[...card.parentElement.children].indexOf(card);if(event.target.dataset.tecField==='subject'||event.target.dataset.tecField==='topic'){const subjectId=card.querySelector('[data-tec-field="subject"]').value,row={...draft.groups[i],topic:card.querySelector('[data-tec-field="topic"]').value};card.querySelector('[data-tec-field="stage"]').innerHTML=stageOptions(row,subjectId,'');}});
  $('tecBatchForm').onsubmit=event=>{
   event.preventDefault();$('tecBatchError').hidden=true;try{
    if(!enabled()||!draft||!same(draft.context)||S().session?.tec?.id!==draft.sessionId)throw Error('A conta, a prova ou a sessão mudou. Volte ao contexto original para salvar.');
    if(receipt(draft.sessionId)){review.close();return;}
    const rows=readRows();if(rows.reduce((n,r)=>n+r.seconds,0)!==draft.totalSeconds)throw Error('A soma dos tempos por tópico deve ser igual a '+api.time(draft.totalSeconds)+'.');
    for(const r of rows){if(!r.topic||![r.correct,r.wrong,r.seconds].every(n=>Number.isInteger(n)&&n>=0)||r.correct+r.wrong<1||r.correct+r.wrong>1000000)throw Error('Confira o tópico, os resultados e o tempo de cada registro.');if(r.subjectId!=='__new__'&&!S().subjects.some(m=>m.id===r.subjectId))throw Error('Selecione uma matéria válida.');if(r.stageId&&!candidates(r.subjectId,r.topic).some(x=>x.stage.id===r.stageId))throw Error('Selecione uma etapa de questões da matéria correta.');}
    const before=structuredClone(S());try{
     const newSubjects=new Map(),date=new Date().toISOString();
     for(const row of rows){let subjectId=row.subjectId;if(subjectId==='__new__'){const k=C.key(row.subject);subjectId=newSubjects.get(k)||S().subjects.find(m=>C.key(m.name)===k)?.id;if(!subjectId){subjectId=api.uid();S().subjects.push({id:subjectId,name:row.subject,color:'#477eb2',contents:['Questões'],topics:[]});}newSubjects.set(k,subjectId);}
      const st=S().stages.find(s=>s.id===row.stageId),task=api.isTask(st),id='tec:'+draft.sessionId+':'+row.id;if(S().history.some(h=>h.id===id))continue;
      const entry={id,kind:'study',name:S().subjects.find(m=>m.id===subjectId).name,subjectId,planningId:S().activePlanningId,roundId:S().roundId,stageId:st?.id,content:'Questões',category:'Questões',topic:row.topic,correct:row.correct,wrong:row.wrong,seconds:row.seconds,date,countPlan:!!st,studyMode:task?'task':'time',metricFormats:['Questions'],cardsTotal:0,cardsReviewed:0,cardsNew:0,pages:[],videos:[],comments:[$('tecBatchComments').value.trim(),'TEC · tempo por tópico estimado e conferido.'].filter(Boolean).join('\n'),externalSource:{provider:'tec',sessionId:draft.sessionId,questionIds:row.questionIds,timeEstimated:true},...(task?{units:row.correct+row.wrong,unit:'questões',targetSnapshot:st.target,baselineUnits:Math.max(0,st.done-S().history.filter(h=>h.stageId===st.id&&h.roundId===S().roundId&&h.countPlan).reduce((n,h)=>n+(h.units||0),0))}:{})};
      api.rememberTopic(subjectId,row.topic);api.applyRecord(entry);S().history.push(entry);
     }
     S().ui.tecImportedSessions=[...(S().ui.tecImportedSessions||[]),{id:draft.sessionId,...context(),at:date}].slice(-500);S().session=null;if(!api.persist())throw Error('Não foi possível salvar. Seus dados da sessão foram preservados.');
    }catch(error){api.setState(before);throw error;}
    review.close();draft=null;api.render();api.toast('Sessão do TEC salva por matéria e tópico.');
   }catch(error){$('tecBatchError').textContent=error.message;$('tecBatchError').hidden=false;}
  };
  async function command(message){
   if(message.type==='snapshot'||message.type==='hello')return snapshot();
   if(!enabled())throw Error('Ative a integração pelo botão TEC no Planejamento.');
   if(!same(message.context))throw Error('Selecione no Planejamento a mesma conta, prova e planejamento da sessão do TEC.');
   if(message.type==='recover'){
    if(message.sessionId&&receipt(message.sessionId))return {status:'saved',sessionId:message.sessionId,...snapshot()};
    if(S().session)throw Error('Finalize o cronômetro atual antes de recuperar a sessão guardada.');
    const data=message.payload||{},elapsed=Number(data.elapsed),startedAt=Number(data.startedAt);
    if(typeof message.sessionId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(message.sessionId)||!Number.isInteger(elapsed)||elapsed<0||elapsed>604800||!Number.isFinite(startedAt)||startedAt<=0)throw Error('Sessão guardada inválida.');
    const events=C.events(data.events),id=api.uid();S().session={stageId:id,inlineStage:{id,subjectId:'',content:'Questões',mode:'time',target:1800,done:0,unassigned:true},quick:true,elapsed,running:false,last:Date.now(),mode:'elapsed',phase:'work',phaseLeft:S().pom.work*60,tec:{id:message.sessionId,startedAt,events}};
    api.persist();api.render();return snapshot();
   }
   if(message.type==='start'){
    if(S().session?.tec)return snapshot();
    if(S().session&&!message.payload?.reuse)throw Error('Já existe um cronômetro. Use “Vincular cronômetro atual” ou finalize-o primeiro.');
    if(!S().session){const id=api.uid();S().session={stageId:id,inlineStage:{id,subjectId:'',content:'Questões',mode:'time',target:1800,done:0,unassigned:true},quick:true,elapsed:0,running:false,last:Date.now(),mode:'elapsed',phase:'work',phaseLeft:S().pom.work*60};}
    api.settle();S().session.tec={id:api.uid(),startedAt:Date.now(),events:[]};S().session.running=true;S().session.last=Date.now();api.persist();api.render();return snapshot();
   }
   const se=S().session;if(message.sessionId&&receipt(message.sessionId))return {status:'saved',sessionId:message.sessionId,...snapshot()};
   if(!se?.tec||se.tec.id!==message.sessionId)throw Error('Esta sessão não é o cronômetro ativo. Seus resultados continuam guardados no script.');
   if(message.type==='results'){se.tec.events=C.events(message.payload?.events);api.persist();return snapshot();}
   if(message.type==='pause'||message.type==='resume'){if(review.open)throw Error('Feche a conferência antes de continuar o cronômetro.');api.settle();se.running=message.type==='resume';se.last=Date.now();api.persist();api.updateTimer();return snapshot();}
   if(message.type==='finish'){if(message.payload?.events)se.tec.events=C.events(message.payload.events);const result=showReview();return {...result,...snapshot()};}
   throw Error('Ação de integração desconhecida.');
  }
  window.addEventListener('message',async event=>{
   const m=event.data;if(event.source!==window||event.origin!==location.origin||!m||m.channel!==channel||m.direction!=='request'||typeof m.requestId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(m.requestId))return;
   if(!handled.has(m.requestId)){const work=Promise.resolve().then(()=>command(m)).then(data=>({ok:true,data}),error=>({ok:false,error:error.message}));handled.set(m.requestId,work);if(handled.size>200)handled.delete(handled.keys().next().value);}
   const result=await handled.get(m.requestId);window.postMessage({channel,direction:'response',requestId:m.requestId,...result},location.origin);
  });
  return {review:showReview,snapshot,publish:()=>window.postMessage({channel,direction:'state',data:snapshot()},location.origin)};
 }};
})(globalThis);
