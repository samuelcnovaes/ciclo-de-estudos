function cloudStateJSON(state){const full=JSON.stringify(state);if(full.length<1800000)return full;const active=state.exams?.find(e=>e.id===state.activeExamId),planData=new Set();for(const workspace of [state,...(state.exams||[]).filter(e=>e!==active).map(e=>e.data)]){const data=workspace?.plannings?.find(p=>p.id===workspace.activePlanningId)?.data;if(data)planData.add(data)}return JSON.stringify(state,function(key,value){if(key==='data'&&this===active)return {_activeExamRoot:true};if(key==='stages'&&planData.has(this))return {_activePlanStages:true};return value})}
function cloudHydrateState(data){if(!data||typeof data!=='object')return data;function hydratePlan(workspace){const plan=workspace.plannings?.find(p=>p.id===workspace.activePlanningId);if(plan?.data?.stages?._activePlanStages)plan.data.stages=structuredClone(workspace.stages||[])}hydratePlan(data);for(const exam of data.exams||[]){if(exam.data?._activeExamRoot){const root={};for(const [key,value]of Object.entries(data))if(!['exams','activeExamId','ui'].includes(key))root[key]=structuredClone(value);root.examUi={setupStarted:data.ui?.setupStarted,setupGoalsComplete:data.ui?.setupGoalsComplete};exam.data=root}hydratePlan(exam.data)}return data}

function cloudErrorText(error){
 const code=error?.code||'', message=error?.message||'';
 const messages={invalid_credentials:'E-mail ou senha incorretos. Confira os dados e tente novamente.',email_not_confirmed:'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.',user_already_exists:'Esta conta já existe. Entre ou use “Esqueci a senha”.',weak_password:'Use uma senha com pelo menos 8 caracteres.',over_email_send_rate_limit:'O limite de envio de e-mails foi atingido. Aguarde alguns minutos e tente novamente.',email_address_not_authorized:'O envio de confirmação para este e-mail ainda não está liberado. É necessário configurar o serviço de e-mails do aplicativo.',signup_disabled:'O cadastro de novas contas está desativado.'};
 if(messages[code])return messages[code];
 if(/invalid login credentials/i.test(message))return messages.invalid_credentials;
 if(/email.*not confirmed/i.test(message))return messages.email_not_confirmed;
 if(/sending confirmation email|email address not authorized/i.test(message))return 'Não foi possível enviar o e-mail de confirmação. O serviço de envio de e-mails do aplicativo precisa ser configurado.';
 if(/fetch|network|timeout/i.test(message))return 'Não foi possível conectar. Confira sua internet e tente novamente.';
 return /[À-ÿ]/.test(message)?message:'Não foi possível concluir a operação. Tente novamente.';
}
window.CicloCloud={
 async prepare(account){
  const recoveryRequested=location.hash.includes('type=recovery');
  const client=CicloSupabase.createClient('https://hksxuvnevztwnyfbuftx.supabase.co','sb_publishable_MhGqEKd7AWRC2ICCUViylw_VKh8fzjk',{
   auth:{storageKey:'ciclo-cloud-auth:'+account.id,detectSessionInUrl:true},global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal||AbortSignal.timeout(15000)})}
  });
  const {data,error}=await client.auth.getSession();
  const session=data?.session;
  const cloud={client,user:session?.user||null,account,mode:'local',error:null,recovery:recoveryRequested};
  client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){cloud.recovery=true;setTimeout(()=>document.getElementById('cloudButton')?.click(),100);}if(event==='SIGNED_OUT'&&cloud.user){location.reload();}});
  if(error){cloud.error=error;return cloud;}
  if(!cloud.user)return cloud;
  cloud.mode='cloud';cloud.key='ciclo-estudos-v1:cloud:'+cloud.user.id;
  const metaKey=cloud.key+':sync';let meta=null;
  try{meta=JSON.parse(localStorage.getItem(metaKey));if(meta?.pending?.payload){meta.pending.payload=cloudHydrateState(meta.pending.payload);meta.pending.text=JSON.stringify(meta.pending.payload);}}catch{}
  const shape=p=>{if(!p||!Array.isArray(p.subjects)||!Array.isArray(p.stages)||!Array.isArray(p.history))throw new Error('Dados da nuvem incompatíveis. Exporte uma cópia antes de substituir.');};
  const load=async()=>{const {data,error}=await client.from('ciclo_study_state').select('payload,version').eq('user_id',cloud.user.id).maybeSingle();if(error)throw error;return data;};
  cloud.sync=new CicloSupabase.SnapshotSync({load,validate:shape,write:async(payload,version)=>{
   let q=client.from('ciclo_study_state');
   q=version===null?q.insert({user_id:cloud.user.id,payload}):q.update({payload}).eq('user_id',cloud.user.id).eq('version',version);
   const {data,error}=await q.select('version').maybeSingle();if(error)throw error;return data;
  },cache:pending=>{localStorage.setItem(metaKey,JSON.stringify({version:cloud.needsRestore?(meta?.version??null):cloud.sync.version,pending:pending?{payload:JSON.parse(cloudStateJSON(pending.payload))}:pending}));},onStatus:(status,error)=>{cloud.status=status;cloud.error=error||null;if(status==='saved')cloud.savedAt=new Date();cloud.renderStatus?.();}});
  try{
   let payload=await cloud.sync.restore();
   if(meta?.pending){
    shape(meta.pending.payload);payload=meta.pending.payload;cloud.sync.pending=meta.pending;
    if(meta.version!==cloud.sync.version){cloud.sync.blocked=true;cloud.status='conflict';}
    else cloud.status='pending';
   }else cloud.status='saved';
   if(payload){cloud.initialPayload=payload;try{localStorage.setItem(cloud.key,cloudStateJSON(payload))}catch(error){cloud.localCacheError=error}}
   else localStorage.removeItem(cloud.key);
  }catch(e){
   cloud.error=e;cloud.status='error';cloud.sync.blocked=true;cloud.needsRestore=true;if(meta?.pending)cloud.sync.pending=meta.pending;
   if(!localStorage.getItem(cloud.key)){cloud.fatal=true;}
  }
  let reconnecting=null;
  cloud.retrySync=async()=>{
   if(!cloud.needsRestore)return cloud.sync.flush();if(reconnecting)return reconnecting;
   reconnecting=(async()=>{try{const row=await load();if(row)shape(row.payload);const remoteVersion=row?.version??null,baseline=meta?.version??null;
    if(remoteVersion!==baseline){cloud.needsRestore=false;cloud.sync.blocked=true;cloud.status='conflict';cloud.error=null;cloud.renderStatus?.();return}
    cloud.sync.version=remoteVersion;cloud.sync.saved=row?JSON.stringify(row.payload):'';cloud.sync.blocked=false;cloud.needsRestore=false;await cloud.sync.flush();
   }catch(error){cloud.status='error';cloud.error=error;cloud.renderStatus?.()}})();try{await reconnecting}finally{reconnecting=null}
  };
  return cloud;
 },
 attach(cloud,hooks){
  const $=id=>document.getElementById(id);const label={local:'Somente neste navegador',pending:'Alterações pendentes',saving:'Salvando na nuvem…',saved:'Salvo na nuvem',conflict:'Conflito entre dispositivos',error:'Nuvem indisponível'};
  cloud.renderStatus=()=>{$('cloudStatus').setAttribute('aria-live','polite');$('cloudStatus').title=cloud.status==='saved'?'Dados confirmados no Supabase'+(cloud.savedAt?' às '+cloud.savedAt.toLocaleTimeString('pt-BR'):''):cloud.sync?.pending?'Há alterações que ainda não foram confirmadas pelo Supabase. Mantenha esta página aberta até sincronizar.':'';$('cloudStatus').textContent=label[cloud.status||cloud.mode]||label.local;$('cloudStatus').dataset.status=cloud.status||cloud.mode;$('cloudIdentity').textContent=cloud.user?cloud.user.email:'Entre para acessar os mesmos estudos em outro dispositivo.';$('cloudConnected').hidden=!cloud.user;$('cloudLoginForm').hidden=!!cloud.user;$('cloudMessage').textContent=cloud.error?cloudErrorText(cloud.error):(cloud.notice||'');$('cloudRecovery').hidden=!cloud.recovery;};
  cloud.renderStatus();
  if(cloud.account.standalone)$('cloudMigrate').hidden=true;
  $('cloudButton').onclick=()=>{$('cloudError').hidden=true;cloud.renderStatus();$('cloudDialog').showModal();};
  const err=e=>{$('cloudError').textContent=cloudErrorText(e);$('cloudError').hidden=false;};
  const run=async fn=>{const buttons=[...$('cloudDialog').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$('cloudError').hidden=true;cloud.notice='';$('cloudMessage').textContent='Aguarde…';try{await fn();}catch(e){$('cloudMessage').textContent='';err(e);}finally{buttons.forEach(b=>b.disabled=false);$('cloudPassword').value='';}};
  $('cloudLoginForm').onsubmit=e=>{e.preventDefault();run(async()=>{const {error}=await cloud.client.auth.signInWithPassword({email:$('cloudEmail').value.trim(),password:$('cloudPassword').value});if(error)throw error;location.reload();});};
  $('cloudSignUp').onclick=()=>{if(!$('cloudLoginForm').reportValidity())return;run(async()=>{const {data,error}=await cloud.client.auth.signUp({email:$('cloudEmail').value.trim(),password:$('cloudPassword').value,options:{emailRedirectTo:new URL('./',location.href).href}});if(error)throw error;if(data.session){location.reload();return;}cloud.notice='Confira seu e-mail para confirmar o cadastro. Verifique também a pasta de spam. Depois de confirmar, volte aqui e clique em Entrar na nuvem.';$('cloudMessage').textContent=cloud.notice;$('cloudMessage').scrollIntoView?.({block:'nearest'});});};
  $('cloudReset').onclick=()=>run(async()=>{const email=$('cloudEmail').value.trim();if(!email)throw new Error('Informe seu e-mail primeiro.');const {error}=await cloud.client.auth.resetPasswordForEmail(email,{redirectTo:new URL('./',location.href).href});if(error)throw error;$('cloudMessage').textContent='Se houver uma conta, você receberá as instruções por e-mail.';});
  $('cloudNewPasswordForm').onsubmit=e=>{e.preventDefault();run(async()=>{const {error}=await cloud.client.auth.updateUser({password:$('cloudNewPassword').value});if(error)throw error;$('cloudNewPassword').value='';cloud.recovery=false;history.replaceState(null,'',location.pathname);cloud.renderStatus();$('cloudMessage').textContent='Senha atualizada.';});};
  $('cloudSaveNow').onclick=()=>run(async()=>{await (cloud.retrySync?.()||cloud.sync?.flush());if(cloud.sync?.blocked)throw new Error('A nuvem mudou em outra sessão. Baixe o backup deste rascunho e recarregue os dados da nuvem.');if(cloud.sync?.pending)throw new Error('Ainda há alterações pendentes. Confira a conexão e tente novamente.');});
  $('cloudExport').onclick=()=>hooks.export();
  $('cloudUseRemote').onclick=()=>run(async()=>{
   if(!confirm('Recarregar os dados da nuvem substitui o rascunho local desta conta. Baixe um backup antes se quiser preservá-lo.'))return;
   const {data,error}=await cloud.client.from('ciclo_study_state').select('payload,version').eq('user_id',cloud.user.id).maybeSingle();if(error)throw error;
   if(!data)throw new Error('Esta conta ainda não tem dados na nuvem.');hooks.validate(data.payload);
   localStorage.setItem(cloud.key,cloudStateJSON(data.payload));localStorage.removeItem(cloud.key+':sync');location.reload();
  });
  $('cloudMigrate').onclick=()=>run(async()=>{
   if(cloud.sync.blocked)throw new Error('Resolva a conexão ou o conflito antes de transferir os dados.');
   const legacy='ciclo-estudos-v1';const raw=localStorage.getItem(legacy+':'+cloud.account.id)||(cloud.account.isOwner?localStorage.getItem(legacy):null);
   if(!raw)throw new Error('Não há estudos locais dessa conta neste navegador. Use Dados e backup para importar seu arquivo.');
   const next=hooks.validate(JSON.parse(raw));
   if(!confirm('Transferir os estudos locais para '+cloud.user.email+'? Os dados desta conta na nuvem serão substituídos. A cópia local original será preservada.'))return;
   hooks.replace(next);await cloud.sync.flush();if(cloud.sync.pending||cloud.sync.blocked)throw new Error('Transferência pendente. Baixe um backup e confira o status antes de sair.');$('cloudMessage').textContent='Estudos transferidos e salvos na nuvem.';
  });
  $('cloudSignOut').onclick=()=>run(async()=>{
   await cloud.sync?.flush();if(cloud.sync?.pending||cloud.sync?.blocked)throw new Error('Há alterações não sincronizadas. Exporte o rascunho ou resolva o conflito antes de sair.');
   const {error}=await cloud.client.auth.signOut({scope:'local'});if(error)throw error;location.reload();
  });
  if(cloud.sync){
   cloud.mark=state=>{
    const payload=structuredClone(state);if(payload.session){payload.session.running=false;payload.session.last=0;}
    cloud.sync.mark(payload);
    (cloud.retrySync?.()||cloud.sync.flush());
   };
   setInterval(()=>{if(navigator.onLine)(cloud.retrySync?.()||cloud.sync.flush());},30000);
   window.addEventListener('online',()=>cloud.retrySync?.()||cloud.sync.flush());
   window.addEventListener('pagehide',()=>queueMicrotask(()=>cloud.sync.flush()));
   window.addEventListener('beforeunload',event=>{if(cloud.sync.pending){cloud.sync.flush();event.preventDefault();event.returnValue='';}});
   if(cloud.sync.pending)(cloud.retrySync?.()||cloud.sync.flush());
   document.addEventListener('visibilitychange',()=>{if(document.hidden)cloud.sync.flush();});
   window.addEventListener('storage',e=>{if(e.key===cloud.key||e.key===cloud.key+':sync'){cloud.sync.blocked=true;cloud.status='conflict';cloud.renderStatus();}});
  }
  if(cloud.status==='conflict'||cloud.recovery)setTimeout(()=>{$('cloudButton').click();},300);
 }
};
