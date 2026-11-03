// Move existing entities between plans in one persisted snapshot; never copy studies.
(function(global){
  function create(api){
    const S=api.getState;
    const plans=()=>[...(S().plannings||[]),...(S().archivedPlannings||[])];
    const stages=plan=>plan.id===S().activePlanningId?(S().stages||[]):(plan.data.stages||[]);
    function historyOwner(row){return row.planningId==='__unassigned__'?'':row.planningId||plans().find(p=>row.roundId&&p.data.roundId===row.roundId)?.id||plans().find(p=>stages(p).some(s=>s.id===row.stageId))?.id||'';}
    function reviewOwner(row){return row.planningId==='__unassigned__'?'':row.planningId||plans().find(p=>stages(p).some(s=>s.sourceReviewId===row.id))?.id||historyOwner(row.manualSource||(S().history||[]).find(h=>h.id===row.studyId)||{});}
    function rows(kind,source){return (kind==='reviews'?(S().reviews||[]).filter(r=>r.status==='scheduled'):(S().history||[]).filter(h=>h.kind==='study')).filter(row=>(kind==='reviews'?reviewOwner(row):historyOwner(row))===source);}
    function fingerprint(kind,source,destination,ids,includeReviews){
      const selected=new Set(ids),studies=kind==='history'?rows(kind,source).filter(h=>selected.has(h.id)):[];
      const reviews=(S().reviews||[]).filter(r=>kind==='reviews'?selected.has(r.id):studies.some(h=>h.id===r.studyId));
      return JSON.stringify([S().activeExamId,kind,source,destination,includeReviews,rows(kind,source).filter(r=>selected.has(r.id)),reviews,plans().map(p=>[p.id,p.data.roundId,stages(p)])]);
    }
    function detach(record){
      if(!record.countPlan)return;
      const plan=plans().find(p=>p.id===historyOwner(record)),stage=plan&&stages(plan).find(s=>s.id===record.stageId);
      if(stage&&(record.roundId===plan.data.roundId||stage.carriedHistoryIds?.includes(record.id))){
        const amount=stage.mode==='task'?Number(record.units)||0:Number(record.seconds)||0;
        stage.done=Math.max(0,(Number(stage.done)||0)-amount);
        if(stage.carriedHistoryIds)stage.carriedHistoryIds=stage.carriedHistoryIds.filter(id=>id!==record.id);
      }
      record.countPlan=false;delete record.stageId;delete record.baselineUnits;record.taskCompleted=false;
    }
    function migrate({kind,source,destination,ids,includeReviews=true,expected}){
      const state=S();
      if(!['reviews','history'].includes(kind))throw Error('Escolha revisões ou histórico.');
      if(state.session)throw Error('Salve ou cancele o cronômetro antes de migrar.');
      if(source===destination)throw Error('Escolha um planejamento de destino diferente da origem.');
      const target=(state.plannings||[]).find(p=>p.id===destination);
      if(!target)throw Error('O planejamento de destino não está mais disponível.');
      const wanted=new Set(ids),selected=rows(kind,source).filter(row=>wanted.has(row.id));
      if(!wanted.size||wanted.size!==selected.length)throw Error('A seleção mudou. Atualize a lista e selecione os itens novamente.');
      if(expected&&expected!==fingerprint(kind,source,destination,ids,includeReviews))throw Error('Os dados mudaram. Atualize a lista antes de migrar.');
      const before=structuredClone(state);
      try{
        // Pin inferred ownership before changing any sources, stages or history.
        for(const row of state.history||[])if(row.kind==='study'&&!row.planningId)row.planningId=historyOwner(row)||'__unassigned__';
        for(const row of state.reviews||[])if(!row.planningId)row.planningId=reviewOwner(row)||'__unassigned__';
        const reviewIds=new Set(kind==='reviews'?ids:includeReviews?(state.reviews||[]).filter(r=>r.status==='scheduled'&&wanted.has(r.studyId)).map(r=>r.id):[]);
        let reviewCount=0;
        for(const review of state.reviews||[]){
          if(!reviewIds.has(review.id)||review.planningId===destination)continue;
          // Carry only the remaining obligation. Earlier studies retain their own statistics.
          let remainder=null;
          for(const plan of plans()){
            const list=stages(plan),linked=list.filter(s=>s.sourceReviewId===review.id);
            for(const stage of linked){
              const left=Math.max(0,stage.target-stage.done);
              if(!remainder&&left>0){remainder=structuredClone(stage);remainder.id=api.uid();remainder.done=0;remainder.target=Math.max(stage.mode==='task'?1:60,left);delete remainder.carriedHistoryIds;delete remainder.transientRoundId;}
              for(const record of state.history||[])if(record.kind==='study'&&record.stageId===stage.id&&historyOwner(record)===plan.id)detach(record);
            }
            const remaining=list.filter(s=>s.sourceReviewId!==review.id);
            if(plan.id===state.activePlanningId)state.stages=remaining;else plan.data.stages=remaining;
          }
          if(remainder)stages(target).push(remainder);
          review.planningId=destination;reviewCount++;
        }
        if(kind==='history')for(const record of selected){detach(record);record.planningId=destination;}
        // Snapshot the live plan so switching and cloud synchronization see the same stages.
        const active=(state.plannings||[]).find(p=>p.id===state.activePlanningId);
        if(active)active.data.stages=structuredClone(state.stages);
        state.dailyPlan=null;
        if(!api.persist())throw Error('Não foi possível salvar a migração. Nenhum item foi migrado.');
        return {history:kind==='history'?selected.length:0,reviews:reviewCount};
      }catch(error){api.setState(before);throw error;}
    }
    return {plans,historyOwner,reviewOwner,rows,fingerprint,migrate};
  }
  global.CicloPlanningMigration={create};
})(typeof window==='undefined'?globalThis:window);
