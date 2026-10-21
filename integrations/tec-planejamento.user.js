// ==UserScript==
// @name         Meta automática — TEC e Aprovado - GPT
// @namespace    samuel.meta.questoes
// @version      2.0.1
// @description  Conta questões, mantém as metas e sincroniza sessões por matéria e tópico com o Planejamento.
// @match        https://tecconcursos.com.br/*
// @match        https://*.tecconcursos.com.br/*
// @match        https://aprovadoapp.com/*
// @match        https://*.aprovadoapp.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @match        https://samuelcnovaes.github.io/ciclo-de-estudos/*
// @grant        GM_deleteValue
// @grant        GM_removeValueChangeListener
// @run-at       document-idle
// @noframes
// ==/UserScript==
/* TEC PLANNER BRIDGE START */
(() => {
 'use strict';
 const URL='https://samuelcnovaes.github.io/ciclo-de-estudos/',isPlanner=location.origin==='https://samuelcnovaes.github.io'&&location.pathname.startsWith('/ciclo-de-estudos/'),isTec=/(^|\.)tecconcursos\.com\.br$/.test(location.hostname);
 if(!isPlanner&&!isTec)return;
 const P='mq1:planner:',SNAP=P+'snapshot',SESSION=P+'session',SIGNAL=P+'signal',id=crypto.randomUUID(),channel='ciclo-tec-v1';
 const get=(k,f=null)=>GM_getValue(k,f),set=(k,v)=>GM_setValue(k,v),remove=k=>{if(typeof GM_deleteValue==='function')GM_deleteValue(k)};
 let plannerWindow=null;const plannerOpen=()=>{plannerWindow=window.open(URL,'ciclo-tec-planejamento');};const plannerFocus=()=>{if(plannerWindow&&!plannerWindow.closed)plannerWindow.focus();};
 if(isPlanner){
  const wait=new Map();
  function leader(){const lease=get(P+'host');if(lease&&lease.id!==id&&lease.until>Date.now())return false;set(P+'host',{id,until:Date.now()+10000});return true;}
  function ask(type,message={}){return new Promise((resolve,reject)=>{const requestId=message.id||crypto.randomUUID(),timeout=setTimeout(()=>{wait.delete(requestId);reject(Error('Planejamento ainda está carregando.'));},8000);wait.set(requestId,{resolve,reject,timeout});document.dispatchEvent(new CustomEvent('ciclo-tec-request',{detail:JSON.stringify({channel,direction:'request',requestId,type,...message})}));});}
  document.addEventListener('ciclo-tec-response',event=>{if(event.target!==document||typeof event.detail!=='string')return;let m;try{m=JSON.parse(event.detail)}catch{return;}if(m?.channel!==channel)return;if(m.direction==='state'){if(leader())set(SNAP,{...m.data,at:Date.now(),hostId:id});return;}if(m.direction!=='response'||!wait.has(m.requestId))return;const pending=wait.get(m.requestId);wait.delete(m.requestId);clearTimeout(pending.timeout);m.ok?pending.resolve(m.data):pending.reject(Error(m.error));});
  let polling=false;async function poll(){if(polling||!leader())return;polling=true;try{const data=await ask('snapshot');set(SNAP,{...data,at:Date.now(),hostId:id});}catch{}finally{polling=false;}}
  async function receive(requestId){const r=get(P+'request:'+requestId);if(!r||r.hostId!==id||Date.now()-r.at>60000)return;try{const data=await ask(r.type,{id:r.id,context:r.context,sessionId:r.sessionId,payload:r.payload});set(P+'response:'+r.id,{ok:true,data});poll();}catch(error){set(P+'response:'+r.id,{ok:false,error:error.message});}}
  GM_addValueChangeListener(SIGNAL,(_k,_old,value)=>receive(value));setInterval(poll,2000);poll();return;
 }
 const host=document.createElement('div');host.id='tec-planner-widget';host.style.cssText='position:fixed;left:16px;bottom:16px;z-index:2147483646;max-width:calc(100vw - 32px)';document.documentElement.append(host);const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>:host{font:13px system-ui,sans-serif;color:#eef4ff}*{box-sizing:border-box}.box{width:320px;max-width:calc(100vw - 32px);background:linear-gradient(140deg,#15263e,#1b3556);border:1px solid #6685b3;border-radius:16px;padding:14px;box-shadow:0 10px 35px #09172c55}.head{display:flex;align-items:center;justify-content:space-between;font-weight:750}button{font:inherit;cursor:pointer;border:1px solid #809bc1;border-radius:8px;background:#2a466c;color:white;padding:8px 10px}button:disabled{opacity:.5;cursor:default}.primary{background:#a7d1ff;color:#112b49;border:0;font-weight:750}.clock{font-size:32px;font-weight:800;font-variant-numeric:tabular-nums;text-align:center;padding:8px 0}.buttons{display:flex;flex-wrap:wrap;gap:6px}.buttons button{flex:1}.note{font-size:11px;color:#c4d5ed;line-height:1.5;margin:9px 0}.status{white-space:pre-wrap;font-size:12px;line-height:1.5;margin:8px 0;color:#ffd69f}.summary{max-height:150px;overflow:auto;font-size:11px;line-height:1.5}.summary>div{padding:6px 0;border-top:1px solid #7898c23b}a{color:#c5e0ff}.collapsed .body{display:none}</style><section class="box"><div class="head"><span>TEC + Planejamento</span><button id="collapse" aria-label="Expandir ou recolher integração">−</button></div><div class="body"><p id="context" class="note"></p><div id="clock" class="clock">00:00:00</div><div class="buttons"><button id="connect">Conectar ao Planejamento</button><button id="start" class="primary">Iniciar sessão</button><button id="reuse">Vincular cronômetro atual</button><button id="recover">Recuperar sessão guardada</button><button id="pause">Pausar</button><button id="finish" class="primary">Conferir e salvar</button></div><p id="status" class="status" role="status"></p><div id="summary" class="summary"></div><p class="note">Tópicos aleatórios são separados automaticamente. Mantenha o Planejamento aberto. O tempo por tópico será estimado e poderá ser ajustado na conferência.</p></div></section>`;
 const $=name=>root.getElementById(name),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),format=n=>{n=Math.max(0,Math.floor(n));return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':')};
 let busy=false,lastSent='';
 function connection(){const s=get(SNAP);return s&&s.enabled&&Date.now()-s.at<20000?s:null;}
 function same(a,b){return a&&b&&['accountId','examId','planningId'].every(k=>a[k]===b[k]);}
 function status(text){$('status').textContent=text;}
 function request(type,payload={},session=(type==='start'?null:get(SESSION))){if(session?.saved)session=null;const snap=connection();if(!snap)return Promise.reject(Error('Abra o Planejamento e ative a integração pelo botão TEC.'));if(session&&!same(snap.context,session.context))return Promise.reject(Error('Volte à conta, prova e planejamento desta sessão. Os resultados estão guardados.'));return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID(),key=P+'response:'+requestId;let listener=null;const done=value=>{if(!value)return;clearTimeout(timeout);if(listener!==null&&typeof GM_removeValueChangeListener==='function')GM_removeValueChangeListener(listener);remove(P+'request:'+requestId);remove(key);value.ok?resolve(value.data):reject(Error(value.error));};const timeout=setTimeout(()=>{if(listener!==null&&typeof GM_removeValueChangeListener==='function')GM_removeValueChangeListener(listener);reject(Error('Sem confirmação do Planejamento. A sessão continua guardada.'));},15000);listener=GM_addValueChangeListener(key,(_k,_o,value)=>done(value));set(P+'request:'+requestId,{id:requestId,type,payload,sessionId:session?.id,context:session?.context||snap.context,hostId:snap.hostId,at:Date.now()});set(SIGNAL,requestId);const existing=get(key);if(existing)done(existing);});}
 function elapsed(snap){const t=snap?.timer;if(!t)return 0;let delta=t.running?Math.max(0,(Date.now()-snap.at)/1000):0;if(t.mode==='pomodoro')delta=t.phase==='rest'?0:Math.min(delta,t.phaseLeft);return Math.floor(t.elapsed+delta);}
 function activeOwner(){const lease=get(P+'controller');if(lease&&lease.id!==id&&lease.until>Date.now())return false;set(P+'controller',{id,until:Date.now()+8000});return true;}
 function collect(session,snap){
  for(const e of session.events){const topic=get('mq1:topicEvent:'+e.id)?.topic;if(topic){e.subject=topic.subject;e.topic=topic.name;}}
  const known=new Set(session.events.map(e=>e.id)),fresh=[];
  for(const key of GM_listValues()){if(!key.startsWith('mq1:event:'))continue;const e=get(key);if(!e||known.has(e.id)||e.ts<session.since||get('mq1:void:'+e.id,false))continue;const topic=get('mq1:topicEvent:'+e.id)?.topic||{subject:'Matéria não identificada',name:'Tópico não identificado'};fresh.push({id:e.id,subject:topic.subject,topic:topic.name,correct:Number(e.correct)||0,wrong:Number(e.wrong)||0,ts:e.ts});}
  fresh.sort((a,b)=>a.ts-b.ts||a.id.localeCompare(b.id));const end=Math.max(session.lastElapsed||0,elapsed(snap)),start=session.lastElapsed||0;fresh.forEach((e,i)=>{e.elapsed=start+(end-start)*(i+1)/fresh.length;session.events.push(e);});
  // Manual voids remain reversible in the original gadget and are removed from this session too.
  session.events=session.events.filter(e=>!get('mq1:void:'+e.id,false));if(fresh.length)session.lastElapsed=end;session.lastClock=end;session.updatedAt=Date.now();set(SESSION,session);return fresh.length;
 }
 function render(){const snap=connection(),session=get(SESSION),bound=!!session&&!session.saved,matching=snap&&(!bound||same(snap.context,session.context)),active=matching&&bound&&snap.timer?.sessionId===session.id;
  const observed=get(SNAP);$('context').textContent=snap?'Conectado · '+snap.examName+' · '+snap.planningName:observed&&Date.now()-observed.at<20000&&!observed.enabled?'Planejamento detectado. Ative a integração pelo botão TEC no cabeçalho do Planejamento.':'Sem conexão. Abra o Planejamento, confira se este script está habilitado nos dois sites e ative a integração pelo botão TEC.';$('clock').textContent=format(active?elapsed(snap):bound?session.lastClock||0:0);
  $('recover').hidden=!bound||!!snap?.timer;$('recover').disabled=busy||!matching;$('start').hidden=bound;$('start').disabled=busy||!snap||!!snap.timer;$('reuse').hidden=bound||!snap?.timer;$('reuse').disabled=busy||!snap;$('pause').hidden=!bound;$('pause').disabled=busy||!active;$('pause').textContent=snap?.timer?.running?'Pausar':'Continuar';$('finish').hidden=!bound;$('finish').disabled=busy||!active;
  const totals=new Map();for(const e of bound?session.events:[]){const k=JSON.stringify([e.subject,e.topic]);if(!totals.has(k))totals.set(k,{subject:e.subject,topic:e.topic,correct:0,wrong:0});const g=totals.get(k);g.correct+=e.correct;g.wrong+=e.wrong;}
  $('summary').innerHTML=[...totals.values()].map(g=>'<div><b>'+esc(g.subject)+'</b> · '+esc(g.topic)+'<br>'+g.correct+' acertos · '+g.wrong+' erros</div>').join('');
  if(bound&&!matching)status('Sessão guardada. Reabra o Planejamento na mesma conta, prova e planejamento.');
 }
 async function act(type,payload={}){if(busy)return;busy=true;render();try{const data=await request(type,payload);if(type==='start'||type==='recover'){if(!data.timer?.sessionId)throw Error('Não foi possível vincular o cronômetro.');const prior=get(SESSION);set(SESSION,{id:data.timer.sessionId,context:data.context,since:data.timer.startedAt,events:prior?.id===data.timer.sessionId?prior.events:[],lastElapsed:prior?.id===data.timer.sessionId?prior.lastElapsed||0:0,lastClock:data.timer.elapsed,controller:id});lastSent='';status('Sessão iniciada. Resolva questões de quaisquer matérias e tópicos.');}else if(type==='finish'){status('Conferência aberta no Planejamento. Confira os tópicos e clique em Salvar registros.');plannerFocus();}else status(type==='pause'?'Cronômetro pausado.':'Cronômetro em andamento.');}catch(error){status(error.message);}finally{busy=false;render();}}
 $('recover').onclick=()=>{const s=get(SESSION);if(s)act('recover',{elapsed:s.lastClock||0,startedAt:s.since,events:s.events});};$('connect').onclick=plannerOpen;$('start').onclick=()=>act('start',{},null);$('reuse').onclick=()=>act('start',{reuse:true});$('pause').onclick=()=>act(connection()?.timer?.running?'pause':'resume');$('finish').onclick=async()=>{if(busy)return;busy=true;render();status('Conferindo as últimas respostas…');await new Promise(resolve=>setTimeout(resolve,900));const session=get(SESSION),snap=connection();busy=false;if(!session||!snap){render();status('Reabra o Planejamento. Sua sessão continua guardada.');return;}collect(session,snap);await act('finish',{events:session.events});};
 $('collapse').onclick=()=>{const collapsed=!root.querySelector('.box').classList.contains('collapsed');root.querySelector('.box').classList.toggle('collapsed',collapsed);$('collapse').textContent=collapsed?'+':'−';set(P+'collapsed',collapsed);};if(get(P+'collapsed',false)){$('collapse').click();}
 let ticking=false;async function tick(){if(ticking)return;ticking=true;try{const session=get(SESSION),snap=connection();if(session&&!session.saved&&snap&&same(session.context,snap.context)){if(snap.receipts?.includes(session.id)){session.saved=true;set(SESSION,session);lastSent='';status('✓ Registros salvos no Planejamento. Você pode iniciar outra sessão.');}else if(snap.timer?.sessionId===session.id&&activeOwner()){collect(session,snap);const signature=JSON.stringify(session.events);if(signature!==lastSent&&!busy){await request('results',{events:session.events},session);lastSent=signature;}}}render();}catch(error){status(error.message);}finally{ticking=false;}}
 GM_addValueChangeListener(SNAP,()=>{render();});GM_addValueChangeListener(SESSION,()=>render());setInterval(tick,1000);render();tick();
})();
/* TEC PLANNER BRIDGE END */


if (!(location.origin === "https://samuelcnovaes.github.io" && location.pathname.startsWith("/ciclo-de-estudos/"))) {


(() => {
  'use strict';

  const PREFIX = 'mq1:';
  const EVENT = PREFIX + 'event:';
  const GOAL = PREFIX + 'goal:';
  const SIGNAL = PREFIX + 'signal';

  const isTec = /(^|\.)tecconcursos\.com\.br$/.test(location.hostname);

  function day(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function goalFor(date) {
    const keys = GM_listValues()
      .filter(k => k.startsWith(GOAL) && k.slice(GOAL.length) <= date)
      .sort();

    return keys.length
      ? GM_getValue(keys[keys.length - 1], 50)
      : 50;
  }

  function records() {
    return GM_listValues()
      .filter(k => k.startsWith(EVENT))
      .map(k => GM_getValue(k))
      .filter(e => e && !GM_getValue(PREFIX + 'void:' + e.id, false));
  }

  function totals(events, date) {
    return events.filter(e => e.day === date).reduce((sum, e) => {
      sum.total += e.total;
      sum.correct += e.correct;
      sum.wrong += e.wrong;
      return sum;
    }, { total: 0, correct: 0, wrong: 0 });
  }

  const host = document.createElement('div');

  host.style.cssText = `
    position:fixed;
    right:16px;
    bottom:16px;
    z-index:2147483647;
  `;

  document.documentElement.appendChild(host);

  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
    <style>
      :host {
        all:initial;
        font:14px/1.5 system-ui,sans-serif;
        color:#18304b;
        color-scheme:light;
      }
      * { box-sizing:border-box; }
      .panel {
        width:320px;
        max-width:calc(100vw - 32px);
        max-height:calc(100dvh - 32px);
        overflow:auto;
        padding:18px;
        background:white;
        border:1px solid #dbe3ed;
        border-radius:16px;
        box-shadow:0 8px 36px #162b4933;
      }
      header {
        display:flex;
        align-items:center;
        justify-content:space-between;
      }
      h2 { margin:0; font-size:17px; }
      p { margin:10px 0; }
      button,input { font:inherit; }
      button {
        cursor:pointer;
        border:1px solid #dbe3ed;
        border-radius:8px;
        padding:8px 12px;
        background:#f4f7fc;
        color:#18304b;
      }
      button:hover { background:#e7eefb; }
      button:focus-visible,input:focus-visible {
        outline:3px solid #5687ef;
      }
      input {
        width:88px;
        padding:7px;
        border:1px solid #bfcbdc;
        border-radius:7px;
        background:white;
        color:#18304b;
      }
      .number { font-size:36px; font-weight:800; }
      .muted { color:#607086; font-size:12px; }
      .status { color:#2856b7; font-size:12px; }
      progress {
        width:100%;
        height:15px;
        accent-color:#3565d9;
      }
      .settings {
        display:flex;
        align-items:center;
        gap:8px;
        margin:14px 0;
      }
      details { margin-top:14px; }
      summary { cursor:pointer; }
      table {
        width:100%;
        border-collapse:collapse;
        font-size:12px;
        margin-top:10px;
      }
      th,td {
        padding:6px 3px;
        border-bottom:1px solid #e7edf5;
        text-align:right;
      }
      th:first-child,td:first-child { text-align:left; }
      #open {
        background:#3565d9;
        color:white;
        border:0;
        border-radius:24px;
        box-shadow:0 4px 20px #162b4933;
      }
      [hidden] { display:none!important; }
    </style>

    <button id="open" hidden></button>

    <section class="panel" id="panel" aria-label="Meta de questões">
      <header>
        <h2>Meta de questões</h2>
        <button id="minimize" aria-label="Minimizar">−</button>
      </header>

      <p id="date" class="muted"></p>

      <div class="number">
        <span id="total">0</span>
        <span class="muted">/ <span id="goal">50</span></span>
      </div>

      <progress id="progress" max="100" value="0"
        aria-label="Progresso da meta"></progress>

      <p id="remaining"></p>
      <p id="stats" class="muted"></p>
      <p id="status" class="status" role="status"
        aria-live="polite"></p>

      <div class="settings">
        <label for="target">Meta diária</label>
        <input id="target" type="number"
          min="1" max="100000" step="1">
        <button id="save">Salvar</button>
      </div>

      <details>
        <summary>Histórico — últimos 7 dias</summary>
        <table>
          <thead>
            <tr><th>Dia</th><th>Feitas/meta</th><th>Acertos</th></tr>
          </thead>
          <tbody id="history"></tbody>
        </table>
      </details>

      <p class="muted">
        Uma contagem por questão a cada dia.
        Compartilhado entre TEC e Aprovado neste perfil
        do navegador. O dia segue o horário do computador.
      </p>
    </section>
  `;

  const $ = id => root.getElementById(id);

  let minimized = GM_getValue(PREFIX + 'collapsed', false);

  function status(text) {
    $('status').textContent = text;
  }

  function render() {
    const today = day();
    const events = records();
    const sum = totals(events, today);
    const goal = goalFor(today);

    $('panel').hidden = minimized;
    $('open').hidden = !minimized;
    $('open').textContent = `Questões: ${sum.total}/${goal}`;

    $('date').textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });

    $('total').textContent = sum.total;
    $('goal').textContent = goal;
    $('progress').value = Math.min(100, sum.total / goal * 100);

    $('remaining').textContent = sum.total >= goal
      ? '✓ Meta diária atingida!'
      : `Faltam ${goal - sum.total} questões.`;

    const answered = sum.correct + sum.wrong;
    const accuracy = answered
      ? Math.round(sum.correct / answered * 100) + '%'
      : '—';

    $('stats').textContent =
      `${sum.correct} acertos · ${sum.wrong} erros · ${accuracy}`;

    if (root.activeElement !== $('target')) {
      $('target').value = goal;
    }

    $('history').replaceChildren();

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const key = day(date);
      const value = totals(events, key);
      const row = document.createElement('tr');

      const cells = [
        date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit'
        }),
        `${value.total}/${goalFor(key)}`,
        String(value.correct)
      ];

      for (const text of cells) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.appendChild(cell);
      }

      $('history').appendChild(row);
    }
  }

  function sync() {
    GM_setValue(SIGNAL, crypto.randomUUID());
    render();
  }

  $('save').onclick = () => {
    const value = Number($('target').value);

    if (!Number.isInteger(value) || value < 1 || value > 100000) {
      status('Informe uma meta inteira entre 1 e 100.000.');
      return;
    }

    GM_setValue(GOAL + day(), value);
    sync();
    status('Meta salva para hoje e próximos dias.');
  };

  $('minimize').onclick = () => {
    minimized = true;
    GM_setValue(PREFIX + 'collapsed', true);
    render();
  };

  $('open').onclick = () => {
    minimized = false;
    GM_setValue(PREFIX + 'collapsed', false);
    render();
  };

  function visible(element) {
    return !!element &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden' &&
      !element.closest('.ng-hide,[hidden]');
  }

  function questionId(scope) {
    const input = scope.querySelector('input[id-questao]');

    if (input && /^\d+$/.test(input.value)) {
      return input.value;
    }

    const link = scope.querySelector('a.id-questao[href]');

    return link?.href.match(/\/questoes\/(\d+)(?:[/?#]|$)/)?.[1]
      || null;
  }

  function resultIn(scope) {
    return [...scope.querySelectorAll(
      '.questao-enunciado-resolucao-acertou,' +
      '.questao-enunciado-resolucao-errou'
    )].find(visible);
  }

  let pending = null;

  function prepare(button) {
    if (!visible(button) || button.disabled ||
        button.getAttribute('aria-disabled') === 'true') return;

    const scope = button.closest('.questao-rg-area')
      || button.closest('.questao');

    // Não contabiliza uma resposta que já estava aberta.
    if (!scope || resultIn(scope)) return;

    const id = questionId(scope);

    if (!id) {
      status('Não consegui identificar o número desta questão.');
      return;
    }

    pending = { id, scope, started: Date.now() };
    status(`Questão #${id}: aguardando o resultado do TEC…`);
  }

  function checkResult() {
    if (!pending) return;

    const attempt = pending;

    if (!attempt.scope.isConnected ||
        questionId(attempt.scope) !== attempt.id ||
        Date.now() - attempt.started > 60000) {
      pending = null;
      status('Sem confirmação. Aguardando a próxima resolução.');
      return;
    }

    const result = resultIn(attempt.scope);
    if (!result) return;

    pending = null;

    const today = day();
    const id = `auto:${today}:${attempt.id}`;
    const key = EVENT + id;

    // Chave por data e questão evita duplicação entre abas.
    if (GM_getValue(key, null)) {
      status(`Questão #${attempt.id} já contabilizada hoje.`);
      return;
    }

    const correct = result.classList.contains(
      'questao-enunciado-resolucao-acertou'
    ) ? 1 : 0;

    if (!GM_listValues().includes(GOAL + today)) {
      GM_setValue(GOAL + today, goalFor(today));
    }

    GM_setValue(key, {
      id,
      day: today,
      total: 1,
      correct,
      wrong: 1 - correct,
      ts: Date.now()
    });

    sync();

    status(
      `✓ Questão #${attempt.id} contabilizada: ` +
      (correct ? 'acerto.' : 'erro.')
    );
  }

  if (isTec) {
    status('Automático ativo. Resolva uma questão no TEC.');

    document.addEventListener('click', event => {
      const button = event.target.closest?.('button.botao-resolver');
      if (button) prepare(button);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.repeat ||
          event.composedPath().includes(host)) return;

      if (event.target.closest?.(
        'textarea,input,select,[contenteditable="true"]'
      )) return;

      const buttons = [
        ...document.querySelectorAll('button.botao-resolver')
      ].filter(button => visible(button) && !button.disabled);

      if (buttons.length === 1) prepare(buttons[0]);
    }, true);

    new MutationObserver(checkResult).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });

    setInterval(checkResult, 500);
  } else {
    status('O total registrado automaticamente no TEC aparece aqui.');
  }

  GM_addValueChangeListener(SIGNAL, render);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });

  setInterval(() => {
    if (!document.hidden) render();
  }, 5000);

  render();
})();
// VISUAL TEC TURBO — adicionar ao final do script.
(() => {
  'use strict';

  const host = [...document.documentElement.children].find(el =>
    el.shadowRoot?.getElementById('total') &&
    el.shadowRoot?.getElementById('goal')
  );

  if (!host) return;

  const root = host.shadowRoot;
  if (root.getElementById('turbo-theme')) return;

  const $ = id => root.getElementById(id);
  const panel = $('panel') || $('card');
  const header = panel.querySelector('header');
  const number = $('total').parentElement;
  const originalStats = $('stats');
  const originalStatus = $('status') || $('autoStatus');
  const progress = $('progress');

  // Posição fixa à esquerda.
  host.style.cssText = `
    position:fixed;
    left:14px;
    right:auto;
    top:50%;
    bottom:auto;
    transform:translateY(-50%);
    z-index:2147483647;
  `;

  const style = document.createElement('style');
  style.id = 'turbo-theme';

  style.textContent = `
    :host {
      color-scheme:dark;
      font-family:system-ui,sans-serif;
      color:#eaeaff;
    }

    .panel,.card {
      width:270px;
      max-width:calc(100vw - 28px);
      max-height:calc(100dvh - 28px);
      padding:12px;
      background:#131426;
      border:1px solid #26273f;
      border-radius:15px;
      box-shadow:0 12px 40px #0005;
      overflow:auto;
      scrollbar-width:thin;
    }

    header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin-bottom:13px;
    }

    header h2 {
      font-size:11px;
      font-weight:800;
      letter-spacing:1.3px;
      color:#999cd7;
      margin:0;
    }

    button {
      background:#23243a;
      color:#b9bde5;
      border:1px solid #30314b;
      border-radius:8px;
      padding:7px 9px;
      font-size:11px;
      cursor:pointer;
    }

    button:hover {
      background:#333552;
      color:#fff;
    }

    button:focus-visible,
    input:focus-visible,
    summary:focus-visible {
      outline:2px solid #49c8e2;
      outline-offset:2px;
    }

    header button {
      width:27px;
      height:27px;
      padding:0;
      font-size:18px;
      line-height:1;
    }

    #turbo-box {
      background:linear-gradient(130deg,#242548,#1c1d36);
      border:1px solid #343553;
      border-radius:15px;
      padding:16px 14px 13px;
    }

    #turbo-heading {
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap:8px;
      margin-bottom:12px;
    }

    #turbo-heading .caption {
      font-size:9px;
      font-weight:800;
      letter-spacing:.8px;
      color:#989bd4;
    }

    #turbo-heading .number,
    #turbo-heading .big {
      font-size:22px;
      line-height:1.2;
      letter-spacing:0;
      font-weight:800;
      white-space:nowrap;
      color:#f4f4ff;
    }

    #turbo-heading .number .muted,
    #turbo-heading .big small {
      font-size:11px;
      color:#9297d2;
      font-weight:700;
    }

    #progress {
      display:block;
      width:100%;
      height:9px;
      margin:0;
      border:0;
      border-radius:20px;
      overflow:hidden;
      appearance:none;
      background:#32334f;
      accent-color:#41cbe1;
    }

    #progress::-webkit-progress-bar {
      background:#32334f;
      border-radius:20px;
    }

    #progress::-webkit-progress-value {
      background:linear-gradient(90deg,#45d6ca,#41b9ed);
      border-radius:20px;
    }

    #progress::-moz-progress-bar {
      background:linear-gradient(90deg,#45d6ca,#41b9ed);
      border-radius:20px;
    }

    #turbo-percent {
      text-align:right;
      color:#b1b4db;
      font-size:10px;
      margin:8px 0 0;
    }

    #turbo-metrics {
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:8px;
      margin-top:14px;
    }

    .turbo-metric {
      background:#1d1e32;
      border:1px solid #2c2d44;
      border-radius:13px;
      padding:10px 2px;
      text-align:center;
    }

    .turbo-metric strong {
      display:block;
      font-size:20px;
      line-height:1.25;
      font-weight:800;
    }

    .turbo-metric span {
      font-size:8px;
      letter-spacing:.5px;
      color:#9699d1;
    }

    #turbo-hits { color:#28d5a7; }
    #turbo-errors { color:#ff646f; }
    #turbo-rate { color:#ffc400; }

    #turbo-footer {
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
      border-top:1px solid #27283e;
      margin-top:19px;
      padding-top:11px;
      font-size:10px;
      color:#969bd5;
      font-weight:700;
      min-height:30px;
    }

    #turbo-badge {
      font-size:8px;
      letter-spacing:.5px;
      border-radius:5px;
      padding:3px 7px;
      background:#17383a;
      color:#2ad9ac;
    }

    #turbo-badge.error {
      background:#40232f;
      color:#ff7581;
    }

    #turbo-config {
      border-top:1px solid #27283e;
      margin-top:10px;
      padding-top:9px;
      color:#b0b4dc;
    }

    #turbo-config > summary {
      font-size:10px;
      color:#969bd5;
      font-weight:500;
      cursor:pointer;
    }

    #turbo-config .muted,
    #turbo-config .foot {
      color:#a4a8ce;
    }

    #turbo-config input {
      background:#1d1e32;
      color:#eee;
      border:1px solid #444663;
      border-radius:7px;
    }

    #turbo-config details {
      border-color:#30314b;
    }

    #turbo-config td,
    #turbo-config th {
      border-color:#30314b;
      color:#b9bde0;
    }

    #turbo-config .primary {
      background:#4549a0;
      color:#fff;
    }

    #open {
      background:#20213d;
      color:#b9c0ff;
      border:1px solid #3b3e66;
      border-radius:12px;
      font-size:12px;
    }

    #stats,#remaining,#notice,#status,#autoStatus {
      display:none!important;
    }

    [hidden] {
      display:none!important;
    }
  `;

  root.appendChild(style);
  header.querySelector('h2').textContent = '⚡ TEC TURBO';

  const box = document.createElement('section');
  box.id = 'turbo-box';
  box.innerHTML = `
    <div id="turbo-heading">
      <span class="caption">META DIÁRIA DE QUESTÕES</span>
    </div>
    <p id="turbo-percent"></p>
  `;

  box.querySelector('#turbo-heading').appendChild(number);
  box.insertBefore(progress, box.lastElementChild);

  const metrics = document.createElement('div');
  metrics.id = 'turbo-metrics';
  metrics.innerHTML = `
    <div class="turbo-metric">
      <strong id="turbo-hits">0</strong>
      <span>ACERTOS</span>
    </div>
    <div class="turbo-metric">
      <strong id="turbo-errors">0</strong>
      <span>ERROS</span>
    </div>
    <div class="turbo-metric">
      <strong id="turbo-rate">—</strong>
      <span>GERAL</span>
    </div>
  `;

  const footer = document.createElement('div');
  footer.id = 'turbo-footer';
  footer.setAttribute('role', 'status');
  footer.innerHTML = `
    <span id="turbo-question">Automático ativo</span>
    <span id="turbo-badge" hidden></span>
  `;

  const config = document.createElement('details');
  config.id = 'turbo-config';
  config.innerHTML = '<summary>⚙ Meta e histórico</summary>';

  [...panel.children]
    .filter(el => el !== header)
    .forEach(el => config.appendChild(el));

  panel.append(box, metrics, footer, config);

  function updateDesign() {
    const total = Number($('total').textContent) || 0;
    const goal = Number($('goal').textContent) || 50;

    $('turbo-percent').textContent =
      Math.round(total / goal * 100) + '% concluído';

    const text = originalStats.textContent;
    const hits = Number(text.match(/(\d+) acertos/)?.[1] || 0);
    const errors = Number(text.match(/(\d+) erros/)?.[1] || 0);

    $('turbo-hits').textContent = hits;
    $('turbo-errors').textContent = errors;
    $('turbo-rate').textContent = hits + errors
      ? Math.round(hits / (hits + errors) * 100) + '%'
      : '—';

    const message = originalStatus?.textContent || '';
    const result = message.match(
      /#(\d+) contabilizada: (acerto|erro)/i
    );

    $('turbo-question').textContent = result
      ? '#' + result[1]
      : message;

    $('turbo-badge').hidden = !result;

    if (result) {
      $('turbo-badge').textContent = result[2].toUpperCase();
      $('turbo-badge').classList.toggle(
        'error',
        result[2].toLowerCase() === 'erro'
      );
    }
  }

  const observer = new MutationObserver(updateDesign);

  [originalStats, originalStatus, $('total'), $('goal')]
    .filter(Boolean)
    .forEach(el => observer.observe(el, {
      childList:true,
      subtree:true,
      characterData:true
    }));

  updateDesign();
})();
// Meta em destaque e textos brancos.
(() => {
  const host = [...document.documentElement.children].find(el =>
    el.shadowRoot?.getElementById('turbo-theme')
  );

  if (!host) return;

  const root = host.shadowRoot;
  if (root.getElementById('turbo-contrast')) return;

  const style = document.createElement('style');
  style.id = 'turbo-contrast';

  style.textContent = `
    header h2, button, #open,
    #turbo-heading .caption,
    #turbo-heading .number, #turbo-heading .big,
    #turbo-heading .number .muted,
    #turbo-heading .big small,
    #turbo-percent, .turbo-metric span,
    #turbo-footer, #turbo-config,
    #turbo-config > summary,
    #turbo-config .muted, #turbo-config .foot,
    #turbo-config td, #turbo-config th,
    #turbo-config input {
      color:#fff!important;
    }

    #turbo-heading {
      flex-wrap:wrap;
      gap:10px;
    }

    #turbo-heading .caption {
      flex-basis:100%;
      font-size:10px;
    }

    #turbo-heading .number,
    #turbo-heading .big {
      width:100%;
      text-align:right;
    }

    #goal {
      display:inline-block;
      font-size:30px;
      line-height:1.2;
      font-weight:900;
      color:#fff;
      background:#383b66;
      border:1px solid #9ca4ff;
      border-radius:8px;
      padding:3px 9px;
      margin-left:4px;
      vertical-align:baseline;
    }
  `;

  root.appendChild(style);
})();
// Acumulado e meta semanal.
(() => {
  'use strict';

  const host = [...document.documentElement.children].find(el =>
    el.shadowRoot?.getElementById('turbo-theme')
  );

  if (!host) return;

  const root = host.shadowRoot;
  if (root.getElementById('turbo-week')) return;

  const $ = id => root.getElementById(id);
  const prefix = 'mq1:';
  const weekGoalPrefix = prefix + 'weekGoal:';

  const dateKey = d =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  function weekDates(now = new Date()) {
    const monday = new Date(now);
    monday.setHours(12,0,0,0);
    monday.setDate(
      monday.getDate() - (monday.getDay()+6)%7
    );

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate()+6);

    return {
      start:dateKey(monday),
      today:dateKey(now),
      monday,
      sunday
    };
  }

  // Remove o texto solicitado.
  root.querySelectorAll('p').forEach(p => {
    if (
      p.textContent.includes('Uma contagem por questão a cada dia.') ||
      (
        p.classList.contains('foot') &&
        p.textContent.includes('TEC + Aprovado')
      )
    ) {
      p.remove();
    }
  });

  const style = document.createElement('style');

  style.textContent = `
    #turbo-week {
      margin-top:14px;
      padding:14px;
      background:linear-gradient(130deg,#242548,#1c1d36);
      border:1px solid #343553;
      border-radius:14px;
      color:#fff;
    }

    #turbo-week .week-title {
      font-size:10px;
      font-weight:800;
      letter-spacing:.8px;
      color:#fff;
    }

    #turbo-week-period {
      font-size:10px;
      color:#fff;
      margin:5px 0 9px;
    }

    #turbo-week-numbers {
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap:6px;
      flex-wrap:wrap;
      margin-bottom:10px;
    }

    #turbo-week-done {
      font-size:25px;
      font-weight:800;
      color:#fff;
    }

    #turbo-week-numbers small {
      font-size:10px;
      color:#fff;
    }

    #turbo-week-target {
      display:inline-block;
      font-size:23px;
      font-weight:900;
      background:#383b66;
      border:1px solid #9ca4ff;
      border-radius:7px;
      padding:2px 7px;
      color:#fff;
    }

    #turbo-week-progress {
      display:block;
      width:100%;
      height:9px;
      margin:0;
      border:0;
      border-radius:20px;
      overflow:hidden;
      appearance:none;
      background:#32334f;
      accent-color:#41cbe1;
    }

    #turbo-week-progress::-webkit-progress-bar {
      background:#32334f;
      border-radius:20px;
    }

    #turbo-week-progress::-webkit-progress-value {
      background:linear-gradient(90deg,#45d6ca,#41b9ed);
      border-radius:20px;
    }

    #turbo-week-progress::-moz-progress-bar {
      background:#41cbe1;
      border-radius:20px;
    }

    #turbo-week-left {
      margin:9px 0 0;
      font-size:12px;
      color:#fff;
    }

    #turbo-week-settings {
      margin-top:12px;
      padding-top:10px;
      border-top:1px solid #343553;
      color:#fff;
    }

    #turbo-week-settings label {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      font-size:12px;
    }

    #turbo-week-settings input {
      width:95px;
    }

    #turbo-week-message {
      font-size:11px;
      color:#fff;
    }
  `;

  root.appendChild(style);

  const box = document.createElement('section');
  box.id = 'turbo-week';
  box.setAttribute('aria-label','Progresso semanal');

  box.innerHTML = `
    <div class="week-title">ACUMULADO DA SEMANA</div>
    <p id="turbo-week-period"></p>

    <div id="turbo-week-numbers">
      <div>
        <span id="turbo-week-done">0</span>
        <small>questões</small>
      </div>
      <div>
        <small>Meta</small>
        <span id="turbo-week-target">350</span>
      </div>
    </div>

    <progress
      id="turbo-week-progress"
      max="100"
      value="0"
      aria-label="Progresso da meta semanal">
    </progress>

    <p id="turbo-week-left"></p>
  `;

  $('turbo-metrics').after(box);

  const settings = document.createElement('div');
  settings.id = 'turbo-week-settings';

  settings.innerHTML = `
    <label for="turbo-week-input">
      Meta semanal
      <input
        id="turbo-week-input"
        type="number"
        min="1"
        max="1000000"
        step="1">
    </label>

    <button id="turbo-week-save">
      Salvar meta semanal
    </button>

    <p id="turbo-week-message" role="status"></p>
  `;

  $('turbo-config').appendChild(settings);

  function updateWeek() {
    const w = weekDates();
    const keys = GM_listValues();

    const goals = keys.filter(k =>
      k.startsWith(weekGoalPrefix) &&
      k.slice(weekGoalPrefix.length) <= w.start
    ).sort();

    const target = goals.length
      ? GM_getValue(goals[goals.length-1])
      : (Number($('goal').textContent)||50)*7;

    let total = 0;

    for (const key of keys) {
      if (!key.startsWith(prefix+'event:')) continue;

      const event = GM_getValue(key);

      if (
        event &&
        event.day >= w.start &&
        event.day <= w.today &&
        !GM_getValue(prefix+'void:'+event.id,false)
      ) {
        total += Number(event.total)||0;
      }
    }

    const format = d => d.toLocaleDateString('pt-BR', {
      day:'2-digit',
      month:'2-digit'
    });

    $('turbo-week-period').textContent =
      `${format(w.monday)} a ${format(w.sunday)} · seg–dom`;

    $('turbo-week-done').textContent = total;
    $('turbo-week-target').textContent = target;

    $('turbo-week-progress').value =
      Math.min(100,total/target*100);

    $('turbo-week-left').textContent = total >= target
      ? '✓ Meta semanal atingida!'
      : `Faltam ${target-total} questões para a meta semanal.`;

    if (root.activeElement !== $('turbo-week-input')) {
      $('turbo-week-input').value = target;
    }
  }

  $('turbo-week-save').onclick = () => {
    const value = Number($('turbo-week-input').value);

    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 1000000
    ) {
      $('turbo-week-message').textContent =
        'Informe uma meta inteira entre 1 e 1.000.000.';
      return;
    }

    GM_setValue(
      weekGoalPrefix + weekDates().start,
      value
    );

    GM_setValue(prefix+'signal',crypto.randomUUID());

    $('turbo-week-message').textContent =
      'Meta salva para esta semana e as próximas.';

    updateWeek();
  };

  GM_addValueChangeListener(prefix+'signal',updateWeek);

  const observer = new MutationObserver(updateWeek);

  [$('total'),$('goal')].forEach(el =>
    observer.observe(el, {
      childList:true,
      subtree:true,
      characterData:true
    })
  );

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateWeek();
  });

  setInterval(() => {
    if (!document.hidden) updateWeek();
  },5000);

  updateWeek();
})();
// Meta diária por assunto do TEC.
(() => {
  'use strict';

  const host = [...document.documentElement.children].find(el =>
    el.shadowRoot?.getElementById('turbo-theme')
  );

  if (!host) return;

  const root = host.shadowRoot;
  if (root.getElementById('topic-card')) return;

  const $ = id => root.getElementById(id);
  const P = 'mq1:';
  const isTec = /(^|\.)tecconcursos\.com\.br$/.test(location.hostname);

  const day = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const visible = el =>
    !!el &&
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    !el.closest('.ng-hide,[hidden]');

  const clean = text => (text || '').replace(/\s+/g,' ').trim();
  const goal = () => Number(GM_getValue(P+'topicGoal',5)) || 5;

  function topicIn(scope) {
    if (!scope) return null;

    const field = [
      ...scope.querySelectorAll('.questao-cabecalho-informacoes-assunto')
    ].find(visible);

    const label = field?.querySelector(
      '.questao-cabecalho-informacoes-assunto-link'
    );

    if (!label || !visible(label)) return null;

    const name = clean(label.textContent);

    const subject = clean(
      scope.querySelector(
        '.questao-cabecalho-informacoes-materia a'
      )?.textContent
    );

    if (!name || name.includes('{{') || subject.includes('{{')) return null;

    const link = label.matches('a[href]')
      ? label
      : label.querySelector('a[href]') || label.closest('a[href]');
    const href = link?.getAttribute('href') || '';
    const ids = href.match(/materias\/(\d+)\/assuntos\/(\d+)/);

    // Sem id estável, espera a matéria carregar para não criar chave diferente.
    if (!ids && !subject) return null;

    return {
      key: ids
        ? `id:${ids[1]}:${ids[2]}`
        : `nome:${subject.toLowerCase()}|${name.toLowerCase()}`,
      name,
      subject
    };
  }

  function activeTopic() {
    const field = [
      ...document.querySelectorAll(
        '.questao-cabecalho-informacoes-assunto'
      )
    ].find(visible);

    return topicIn(field?.closest('.questao') || document);
  }

  function questionId(scope) {
    const value = scope.querySelector('input[id-questao]')?.value;

    if (/^\d+$/.test(value || '')) return value;

    return scope.querySelector('a.id-questao[href]')
      ?.href.match(/\/questoes\/(\d+)(?:[/?#]|$)/)?.[1] || null;
  }

  const style = document.createElement('style');

  style.textContent = `
    #topic-card {
      background:#20213e;
      border:1px solid #454974;
      border-radius:14px;
      margin-top:14px;
      padding:13px;
      color:#fff;
    }

    #topic-caption {
      font-size:10px;
      font-weight:800;
      letter-spacing:.7px;
    }

    #topic-name {
      font-size:12px;
      font-weight:700;
      line-height:1.45;
      margin:8px 0;
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
      overflow-wrap:anywhere;
    }

    #topic-count {
      font-size:25px;
      font-weight:900;
      color:#fff;
    }

    #topic-today {
      margin:10px 0 0;
      padding:9px 11px;
      background:#16293a;
      border:1px solid #56d5ec;
      border-left:5px solid #56d5ec;
      border-radius:10px;
    }

    #topic-today-label {
      display:block;
      font-size:10px;
      font-weight:800;
      letter-spacing:.7px;
      color:#56d5ec;
    }

    #topic-today-stats {
      display:flex; gap:10px; margin-top:4px;
      font-size:10px; line-height:1.4; font-weight:500;
    }
    #topic-today-hits { color:#69ffce; }
    #topic-today-errors { color:#ff9da6; }

    #topic-card.done #topic-today {
      background:#12352e;
      border-color:#28d5a7;
    }

    #topic-card.done #topic-today-label,
    #topic-card.done #topic-count {
      color:#69ffce;
    }

    #topic-total {
      display:flex;
      flex-wrap:wrap;
      align-items:baseline;
      gap:2px 10px;
      margin:10px 0 0;
      padding:9px 11px;
      background:#2d2921;
      border:1px solid #ffcd70;
      border-left:5px solid #ffcd70;
      border-radius:10px;
    }

    #topic-total-label {
      flex:1 1 100%;
      font-size:10px;
      font-weight:800;
      letter-spacing:.7px;
      color:#ffcd70;
    }

    #topic-total-number {
      font-size:25px;
      font-weight:900;
      line-height:1.2;
      color:#ffd98f;
    }

    #topic-total-last {
      font-size:11px;
      color:#fff;
    }

    #topic-status {
      font-size:11px;
      color:#fff;
      margin:7px 0 0;
    }

    #topic-card.done {
      border-color:#28d5a7;
      background:#183732;
    }

    #topic-card.done #topic-status {
      font-weight:800;
      color:#69ffce;
    }

    #topic-settings {
      margin-top:12px;
      padding-top:10px;
      border-top:1px solid #343553;
      color:#fff;
    }

    #topic-settings label {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      font-size:12px;
    }

    #topic-settings input { width:75px; }
    #topic-help,#topic-message { font-size:11px;color:#fff; }

    #topic-toast {
      position:fixed;
      left:14px;
      bottom:16px;
      max-width:calc(100vw - 28px);
      width:310px;
      padding:16px 32px 16px 16px;
      box-sizing:border-box;
      background:#173b33;
      color:#fff;
      border:1px solid #28d5a7;
      border-radius:12px;
      box-shadow:0 8px 30px #0005;
      font:700 13px/1.5 system-ui;
      z-index:2147483647;
    }

    #topic-toast button {
      position:absolute;
      right:7px;
      top:7px;
      background:transparent;
      color:white;
      border:0;
      cursor:pointer;
    }
  `;

  root.appendChild(style);

  const card = document.createElement('section');
  card.id = 'topic-card';

  card.innerHTML = `
    <div id="topic-caption">META POR TÓPICO · HOJE</div>
    <div id="topic-name"></div>
    <div id="topic-today">
      <span id="topic-today-label">META DE HOJE NESTE TÓPICO</span>
      <div id="topic-count"></div>
      <div id="topic-today-stats">
        <span id="topic-today-hits">Acertos: —</span>
        <span id="topic-today-errors">Erros: —</span>
      </div>
    </div>
    <div id="topic-total">
      <span id="topic-total-label">ACUMULADO NO TÓPICO</span>
      <strong id="topic-total-number">—</strong>
      <span id="topic-total-last"></span>
    </div>
    <p id="topic-status"></p>
  `;

  ($('turbo-week') || $('turbo-metrics')).after(card);

  const settings = document.createElement('div');
  settings.id = 'topic-settings';

  settings.innerHTML = `
    <label for="topic-input">
      Questões por tópico
      <input id="topic-input" type="number"
        min="1" max="10000" step="1">
    </label>

    <button id="topic-save">Salvar meta por tópico</button>

    <p id="topic-help">
      Padrão: 5. Conta respostas novas, certas ou erradas.
      Questões puladas não contam.
      Cada assunto tem sua contagem diária.
    </p>

    <p id="topic-message" role="status"></p>
  `;

  $('turbo-config').appendChild(settings);

  // Inclusão manual usa os mesmos registros das contagens automáticas.
  const manual = document.createElement('details');
  manual.id = 'topic-manual';
  manual.innerHTML = `
    <summary>＋ Adicionar questões já feitas</summary>
    <form id="topic-manual-form">
      <label>Tópico<select id="manual-topic" required></select></label>
      <p>Para incluir outro tópico, abra uma questão dele no TEC e reabra esta opção.</p>
      <label>Data da resolução<input id="manual-day" type="date" required></label>
      <label>Total de questões<input id="manual-total" type="number" min="1" max="100000" step="1" required></label>
      <label>Acertos<input id="manual-correct" type="number" min="0" max="100000" step="1" required></label>
      <label>Erros<input id="manual-wrong" type="number" min="0" max="100000" step="1" required></label>
      <p>Adicione somente questões ainda não contabilizadas neste navegador. O registro soma às metas da data escolhida.</p>
      <button type="submit">Adicionar ao tópico</button>
    </form>
    <p id="manual-message" role="status"></p>
    <button id="manual-undo" type="button" hidden>Desfazer este lançamento</button>
  `;
  card.appendChild(manual);
  const manualStyle = document.createElement('style');
  manualStyle.textContent = `
    #topic-manual { border-top:1px solid #657492; padding-top:12px; }
    #topic-manual summary { font-size:12px; font-weight:800; color:#fff; }
    #topic-manual label { display:block; margin:10px 0; font-size:11px; color:#fff; }
    #topic-manual input, #topic-manual select { box-sizing:border-box; width:100%;
      display:block; margin-top:5px; padding:8px; background:#111b2d; color:#fff;
      border:1px solid #65cdd6; border-radius:7px; font:12px system-ui; }
    #topic-manual p { font-size:11px; line-height:1.5; color:#fff; }
    #topic-manual button { width:100%; margin-top:8px; color:#fff; }
    #topic-manual button[type=submit] { background:#216153; border-color:#50dfb4; }
    #manual-message[data-error=true] { color:#ffb3bd; }
  `;
  root.appendChild(manualStyle);
  let manualTopics = new Map();
  let lastManualId = null;
  manual.addEventListener('toggle', () => {
    if (!manual.open) return;
    const current = (isTec ? activeTopic() : null) || GM_getValue(P+'activeTopic',null);
    manualTopics = new Map();
    for (const key of GM_listValues()) {
      if (!key.startsWith(P+'topicEvent:')) continue;
      const topic = GM_getValue(key)?.topic;
      if (topic?.key && topic.name) manualTopics.set(topic.key,topic);
    }
    if (current) manualTopics.set(current.key,current);
    $('manual-topic').replaceChildren();
    for (const topic of [...manualTopics.values()].sort((a,b) =>
      `${a.subject} ${a.name}`.localeCompare(`${b.subject} ${b.name}`,'pt-BR'))) {
      const option = document.createElement('option');
      option.value = topic.key;
      option.textContent = [topic.subject,topic.name].filter(Boolean).join(' — ');
      $('manual-topic').appendChild(option);
    }
    if (current) $('manual-topic').value = current.key;
    $('manual-day').max = day();
    if (!$('manual-day').value) $('manual-day').value = day();
  });
  function validateManual(date,total,correct,wrong) {
    const parsed = new Date(date+'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) ||
        dayForManual(parsed) !== date || date > day()) return 'Informe uma data válida, até hoje.';
    if (![total,correct,wrong].every(Number.isInteger) || total < 1 || total > 100000 ||
        correct < 0 || wrong < 0) return 'Informe quantidades inteiras válidas.';
    if (correct+wrong !== total) return 'Acertos + erros devem ser iguais ao total.';
    return '';
  }
  function dayForManual(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  $('topic-manual-form').onsubmit = e => {
    e.preventDefault();
    const topic = manualTopics.get($('manual-topic').value);
    const date = $('manual-day').value;
    const total = Number($('manual-total').value);
    const correct = Number($('manual-correct').value);
    const wrong = Number($('manual-wrong').value);
    const error = !topic ? 'Abra um tópico no TEC antes de adicionar.' : validateManual(date,total,correct,wrong);
    $('manual-message').dataset.error = String(!!error);
    if (error) { $('manual-message').textContent = error; return; }
    const id = 'manual:'+crypto.randomUUID();
    GM_setValue(P+'topicEvent:'+id,{id,day:date,topic});
    GM_setValue(P+'event:'+id,{id,day:date,total,correct,wrong,ts:Date.now(),source:'manual'});
    lastManualId = id;
    $('manual-message').textContent = `${total} questões adicionadas em ${date.split('-').reverse().join('/')}: ${topic.name}.`;
    $('manual-undo').hidden = false;
    for (const field of ['manual-total','manual-correct','manual-wrong']) $(field).value = '';
    GM_setValue(P+'signal',crypto.randomUUID());
    update();
  };
  $('manual-undo').onclick = () => {
    if (!lastManualId) return;
    GM_setValue(P+'void:'+lastManualId,true);
    lastManualId = null;
    $('manual-undo').hidden = true;
    $('manual-message').dataset.error = 'false';
    $('manual-message').textContent = 'Lançamento desfeito.';
    GM_setValue(P+'signal',crypto.randomUUID());
    update();
  };

  const toastHost = document.createElement('div');

  toastHost.style.cssText =
    'position:fixed;left:0;bottom:0;z-index:2147483647;';

  document.documentElement.appendChild(toastHost);

  const toastRoot = toastHost.attachShadow({mode:'open'});
  const toastStyle = document.createElement('style');
  toastStyle.textContent = style.textContent;
  toastRoot.appendChild(toastStyle);

  let toastTimer;

  function announce(topic) {
    toastRoot.querySelector('#topic-toast')?.remove();

    const el = document.createElement('div');
    el.id = 'topic-toast';
    el.setAttribute('role','status');

    const text = document.createElement('span');
    text.textContent =
      `✓ Meta de ${goal()} questões atingida! ` +
      'Avance para o próximo tópico.';

    el.title = topic.name;
    el.appendChild(text);

    const close = document.createElement('button');
    close.textContent = '×';
    close.setAttribute('aria-label','Fechar aviso');
    close.onclick = () => el.remove();
    el.appendChild(close);

    toastRoot.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(),10000);
  }

  let pending = null;
  let lastTopic = '';

  function arm(button) {
    if (!isTec || !visible(button) || button.disabled) return;

    const scope = button.closest('.questao');
    if (!scope) return;

    const topic = topicIn(scope);
    const qid = questionId(scope);
    if (!topic || !qid) return;

    const id = `auto:${day()}:${qid}`;

    // Não duplica questões já respondidas hoje.
    if (GM_getValue(P+'event:'+id,null)) return;

    pending = {
      id,
      topic,
      scope,
      qid,
      started:Date.now()
    };
  }

  function finish() {
    if (!pending) return;

    const attempt = pending;
    const event = GM_getValue(P+'event:'+attempt.id,null);

    // Só registra quando o contador principal confirma a resposta.
    if (event && event.ts >= attempt.started-100) {
      pending = null;

      const key = P+'topicEvent:'+attempt.id;

      if (!GM_getValue(key,null)) {
        GM_setValue(key, {
          id:attempt.id,
          day:event.day,
          topic:attempt.topic
        });

        GM_setValue(P+'signal',crypto.randomUUID());
      }
    } else if (
      !attempt.scope.isConnected ||
      questionId(attempt.scope) !== attempt.qid ||
      Date.now()-attempt.started > 60000
    ) {
      pending = null;
    }
  }

  function tally(topic) {
    const out = { today:0, total:0, correctToday:0, wrongToday:0, last:'' };
    if (!topic) return out;

    const today = day();

    for (const key of GM_listValues()) {
      if (!key.startsWith(P+'topicEvent:')) continue;

      const entry = GM_getValue(key);

      if (!entry || entry.topic?.key !== topic.key) continue;

      const event = GM_getValue(P+'event:'+entry.id,null);

      if (!event || GM_getValue(P+'void:'+entry.id,false)) continue;

      const n = Number(event.total) || 0;

      out.total += n;
      if (entry.day === today) {
        out.today += n;
        out.correctToday += Number(event.correct) || 0;
        out.wrongToday += Number(event.wrong) || 0;
      }
      if (entry.day > out.last) out.last = entry.day;
    }

    return out;
  }

  function update() {
    finish();

    const liveTopic = isTec ? activeTopic() : null;

    // Sem questão aberta, mostra o último tópico visto (salvo no navegador).
    const topic = liveTopic || GM_getValue(P+'activeTopic',null);

    if (liveTopic && liveTopic.key !== lastTopic) {
      lastTopic = liveTopic.key;
      GM_setValue(P+'activeTopic',liveTopic);
    }

    const counts = tally(topic);
    $('topic-today-hits').textContent = 'Acertos: ' + (topic ? counts.correctToday : '—');
    $('topic-today-errors').textContent = 'Erros: ' + (topic ? counts.wrongToday : '—');
    const total = counts.today;
    const target = goal();

    $('topic-name').textContent = topic?.name || (
      isTec
        ? 'Abra uma questão com o campo Assunto visível.'
        : 'Abra um tópico no TEC.'
    );

    $('topic-name').title = topic
      ? `${topic.subject} — ${topic.name}`
      : '';

    $('topic-count').textContent = topic
      ? `${total} / ${target}`
      : `— / ${target}`;

    const done = !!topic && total >= target;
    card.classList.toggle('done',done);

    $('topic-status').textContent = !topic ? '' : done
      ? '✓ Meta atingida! Avance para o próximo tópico.'
      : `Faltam ${target-total} questões neste tópico.`;

    $('topic-total-number').textContent = topic
      ? `${counts.total} ${counts.total === 1 ? 'questão' : 'questões'}`
      : '—';

    $('topic-total-last').textContent = topic && counts.last
      ? `última vez: ${counts.last.split('-').reverse().join('/')}`
      : '';

    if (root.activeElement !== $('topic-input')) {
      $('topic-input').value = target;
    }

    if (done && liveTopic) {
      const key =
        P+'topicNotified:'+day()+':'+topic.key+':'+target;

      if (!GM_getValue(key,false)) {
        GM_setValue(key,true);
        announce(topic);
      }
    }
  }

  $('topic-save').onclick = () => {
    const value = Number($('topic-input').value);

    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 10000
    ) {
      $('topic-message').textContent =
        'Informe um inteiro entre 1 e 10.000.';
      return;
    }

    GM_setValue(P+'topicGoal',value);
    GM_setValue(P+'signal',crypto.randomUUID());

    $('topic-message').textContent = 'Meta por tópico salva.';
    update();
  };

  if (isTec) {
    document.addEventListener('click',e => {
      const button = e.target.closest?.('button.botao-resolver');
      if (button) arm(button);
    },true);

    document.addEventListener('keydown',e => {
      if (
        e.key !== 'Enter' ||
        e.repeat ||
        e.composedPath().includes(host) ||
        e.target.closest?.(
          'textarea,input,select,[contenteditable="true"]'
        )
      ) return;

      const buttons = [
        ...document.querySelectorAll('button.botao-resolver')
      ].filter(b => visible(b) && !b.disabled);

      if (buttons.length === 1) arm(buttons[0]);
    },true);
  }

  GM_addValueChangeListener(
    P+'signal',
    () => setTimeout(update,0)
  );

  GM_addValueChangeListener(
    P+'activeTopic',
    () => setTimeout(update,0)
  );

  new MutationObserver(update).observe($('total'), {
    childList:true,
    subtree:true,
    characterData:true
  });

  setInterval(() => {
    if (!document.hidden) update();
  },700);

  document.addEventListener('visibilitychange',() => {
    if (!document.hidden) update();
  });

  update();
})();
// Popup central adicional: mantém o aviso original no canto.
(() => {
  if (document.getElementById('tec-popup-central')) return;

  const host = document.createElement('div');
  host.id = 'tec-popup-central';
  document.documentElement.appendChild(host);

  const root = host.attachShadow({mode:'open'});

  root.innerHTML = `
    <style>
      dialog {
        position:fixed;
        inset:0;
        margin:auto;
        width:420px;
        max-width:calc(100vw - 32px);
        max-height:calc(100dvh - 32px);
        overflow:auto;
        box-sizing:border-box;
        padding:28px;
        background:#1c1e35;
        color:#fff;
        border:2px solid #28d5a7;
        border-radius:18px;
        box-shadow:0 18px 70px #0008;
        font:15px/1.5 system-ui,sans-serif;
        text-align:center;
      }

      dialog::backdrop {
        background:rgba(0,0,0,.6);
      }

      .icon {
        font-size:38px;
        color:#28d5a7;
      }

      h2 {
        font-size:23px;
        margin:8px 0 12px;
        color:#fff;
      }

      #subject {
        font-size:13px;
        color:#fff;
        overflow-wrap:anywhere;
      }

      #message {
        font-size:16px;
        color:#fff;
        font-weight:700;
      }

      button {
        margin-top:12px;
        padding:12px 22px;
        background:#28d5a7;
        color:#08271f;
        font:700 14px system-ui;
        border:0;
        border-radius:9px;
        cursor:pointer;
      }

      button:focus-visible {
        outline:3px solid white;
        outline-offset:4px;
      }
    </style>

    <dialog
      aria-labelledby="popup-title"
      aria-describedby="subject message">

      <div class="icon" aria-hidden="true">✓</div>
      <h2 id="popup-title">Meta do tópico atingida!</h2>
      <p id="subject"></p>
      <p id="message"></p>

      <button id="close" autofocus>
        Entendi, vou avançar
      </button>
    </dialog>
  `;

  const dialog = root.querySelector('dialog');

  root.getElementById('close').onclick = () => dialog.close();

  const seen = new WeakSet();

  function show(toast) {
    if (!toast || seen.has(toast)) return;
    seen.add(toast);

    root.getElementById('subject').textContent =
      toast.title || '';

    root.getElementById('message').textContent =
      toast.querySelector('span')?.textContent ||
      'Avance para o próximo tópico.';

    if (!dialog.open) dialog.showModal();
  }

  for (const el of document.documentElement.children) {
    const source = el.shadowRoot;
    if (!source || source === root) continue;

    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node.nodeType === 1 &&
            node.id === 'topic-toast'
          ) {
            show(node);
          }
        }
      }
    }).observe(source, {childList:true});

    show(source.querySelector('#topic-toast'));
  }
})();

// Lembrete semanal: somente às segundas-feiras.
(() => {
  'use strict';
  if (!/(^|\.)tecconcursos\.com\.br$/.test(location.hostname) ||
      document.getElementById('tec-weekly-review')) return;

  function reminderKey(now = new Date()) {
    const weekday = now.getDay();
    if (weekday !== 1) return null;
    return 'mq1:weeklyReviewMondayShown:' + [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  }

  const host = document.createElement('div');
  host.id = 'tec-weekly-review';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `
    <style>
      dialog {
        position:fixed; inset:0; margin:auto; box-sizing:border-box;
        width:440px; max-width:calc(100vw - 32px);
        max-height:calc(100dvh - 32px); overflow:auto;
        padding:28px; background:#1c1e35; color:#fff;
        border:2px solid #41cbe1; border-radius:18px;
        box-shadow:0 18px 70px #0008;
        font:15px/1.5 system-ui,sans-serif; text-align:center;
      }
      dialog::backdrop { background:#0009; }
      h2 { margin:0 0 14px; font-size:23px; color:#fff; }
      p { color:#fff; }
      button {
        margin-top:12px; padding:12px 22px; background:#41cbe1;
        color:#08252b; font:700 14px system-ui; border:0;
        border-radius:9px; cursor:pointer;
      }
      button:focus-visible { outline:3px solid #fff; outline-offset:4px; }
    </style>
    <style>
      #review-link {
        display:block; margin-top:18px; padding:12px 16px;
        background:#41cbe1; color:#08252b; border-radius:9px;
        font-weight:800; text-decoration:none;
      }
      #review-link:hover { background:#7be3f3; }
      #review-link:focus-visible { outline:3px solid #fff; outline-offset:4px; }
      #review-close { background:#30364d; color:#fff; }
      #review-new-tab { margin:6px 0 0; font-size:11px; }
      #review-snooze-box { margin-top:18px; padding:14px; border:1px solid #767cac;
        border-radius:10px; background:#252943; }
      #review-hours { width:80px; padding:8px; margin:8px; border-radius:7px;
        border:1px solid #41cbe1; background:#14192d; color:#fff; font:inherit; }
      #review-snooze-box small { display:block; color:#fff; font-size:11px; }
      #review-error { color:#ffb5b5; font-size:12px; }
    </style>
    <dialog aria-labelledby="review-title" aria-describedby="review-text">
      <h2 id="review-title">Hora da análise semanal!</h2>
      <p id="review-text">Faça uma análise de desempenho das matérias:
        confira os acertos e erros, identifique os assuntos com mais
        dificuldade e defina o que revisar na próxima semana.</p>
      <a id="review-link" href="https://samuelcnovaes.github.io/Desempenho/"
        target="_blank" rel="noopener noreferrer" autofocus>Abrir análise de desempenho ↗</a>
      <p id="review-new-tab">Abre em uma nova aba.</p>
      <div id="review-snooze-box">
        <label for="review-hours">Lembrar novamente em
          <input id="review-hours" type="number" min="0.25" max="8760" step="any" value="2"> horas
        </label>
        <button id="review-snooze">Redefinir lembrete</button>
        <small>O aviso fixo de segunda-feira continua ativo.</small>
        <p id="review-error" role="status"></p>
      </div>
      <button id="review-close">Fechar lembrete</button>
    </dialog>
  `;
  const dialog = root.querySelector('dialog');
  root.getElementById('review-close').onclick = () => dialog.close();

  const SNOOZE = 'mq1:weeklyReviewSnoozeUntil';
  root.getElementById('review-snooze').onclick = () => {
    const hours = Number(root.getElementById('review-hours').value);
    if (!Number.isFinite(hours) || hours < 0.25 || hours > 8760) {
      root.getElementById('review-error').textContent =
        'Informe de 0,25 a 8.760 horas (0,5 equivale a 30 minutos).';
      return;
    }
    GM_setValue(SNOOZE, Date.now() + hours * 3600000);
    dialog.close();
  };

  function otherDialogOpen(scope = document) {
    if (scope.querySelector('dialog[open]')) return true;
    for (const element of scope.querySelectorAll('*')) {
      if (element !== host && element.shadowRoot &&
          otherDialogOpen(element.shadowRoot)) return true;
    }
    return false;
  }

  function check() {
    if (document.hidden || dialog.open) return;
    const key = reminderKey();
    const weeklyDue = !!key && !GM_getValue(key, false);
    const until = Number(GM_getValue(SNOOZE, 0));
    const snoozeDue = Number.isFinite(until) && until > 0 && Date.now() >= until;
    if ((!weeklyDue && !snoozeDue) || otherDialogOpen()) return;
    root.getElementById('review-error').textContent = '';
    dialog.showModal();
    if (weeklyDue) GM_setValue(key, true);
    if (snoozeDue) GM_setValue(SNOOZE, 0);
  }

  // Também funciona se a aba permanecer aberta na virada do dia.
  setTimeout(check, 1500);
  setInterval(check, 15000);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
})();

// Organização visual das metas e do histórico.
(() => {
  'use strict';
  const host = [...document.documentElement.children].find(el =>
    el.shadowRoot?.getElementById('turbo-config'));
  if (!host) return;
  const root = host.shadowRoot;
  if (root.getElementById('meta-settings-design')) return;
  const $ = id => root.getElementById(id);
  const config = $('turbo-config');
  const daily = $('target')?.closest('.settings');
  const week = $('turbo-week-settings');
  const topic = $('topic-settings');
  const history = $('history')?.closest('details');
  if (!daily || !week || !topic || !history) return;

  function card(element, kind, title, description) {
    element.classList.add('meta-setting-card', kind);
    const heading = document.createElement('h3');
    heading.textContent = title;
    const help = document.createElement('p');
    help.className = 'meta-setting-help';
    help.textContent = description;
    element.prepend(heading, help);
    return element;
  }

  const dailyCard = document.createElement('section');
  daily.before(dailyCard);
  dailyCard.appendChild(daily);
  card(dailyCard, 'setting-daily', '☀ Meta diária',
    'Total de questões que você quer responder por dia.');
  daily.querySelector('label').textContent = 'Questões por dia';
  $('save').textContent = 'Salvar meta diária';
  card(week, 'setting-weekly', '▦ Meta semanal',
    'Objetivo acumulado de segunda a domingo.');
  card(topic, 'setting-topic', '◎ Meta por tópico',
    'Quantidade por assunto a cada dia. Ao atingir, você recebe um aviso.');
  week.querySelector('label').firstChild.textContent = 'Questões por semana ';
  $('topic-help').textContent = 'Acertos e erros contam. Questões puladas não contam.';
  history.classList.add('meta-setting-card', 'setting-history');
  history.querySelector('summary').textContent = '↗ Histórico · últimos 7 dias';
  config.append(dailyCard, week, topic, history);

  const style = document.createElement('style');
  style.id = 'meta-settings-design';
  style.textContent = `
    #turbo-config > summary {
      padding:12px 10px; border:1px solid #61658c;
      border-radius:10px; background:#292b49;
      font-size:12px; font-weight:800; color:#fff;
    }
    #turbo-config[open] > summary { margin-bottom:12px; }
    #turbo-config #date { font-size:11px; line-height:1.5; }
    #turbo-config .meta-setting-card {
      --section-color:#56d5ec;
      display:block; margin:12px 0 0; padding:12px;
      border:1px solid #454967;
      border-left:4px solid var(--section-color);
      border-radius:12px; background:#1c2035; color:#fff;
    }
    #turbo-config .setting-weekly {
      --section-color:#b39aff; background:#242039;
    }
    #turbo-config .setting-topic {
      --section-color:#50dfb4; background:#192d2c;
    }
    #turbo-config .setting-history {
      --section-color:#ffcd70; background:#2d2921;
    }
    #turbo-config .meta-setting-card h3 {
      font-size:13px; line-height:1.4; margin:0 0 6px;
      font-weight:800; color:var(--section-color);
    }
    #turbo-config .meta-setting-help,
    #turbo-config #topic-help {
      margin:0 0 12px; font-size:11px; line-height:1.55; color:#fff;
    }
    #turbo-config .settings {
      display:grid; grid-template-columns:minmax(0,1fr) 82px;
      align-items:center; gap:10px; margin:0;
    }
    #turbo-config .meta-setting-card label {
      font-size:11px; font-weight:700; gap:8px; line-height:1.4;
    }
    #turbo-config .meta-setting-card input {
      box-sizing:border-box; width:82px; min-width:0;
      padding:9px 6px; background:#101626;
      border:1px solid var(--section-color); border-radius:8px;
      font-size:16px; font-weight:800; text-align:center; color:#fff;
    }
    #turbo-config .meta-setting-card button {
      display:block; width:100%; box-sizing:border-box;
      margin:11px 0 0; padding:10px 6px;
      border:1px solid var(--section-color); border-radius:8px;
      background:#30364d; font-size:11px; font-weight:800; color:#fff;
    }
    #turbo-config .settings button { grid-column:1 / -1; margin:0; }
    #turbo-config .meta-setting-card button:hover { background:#454d6b; }
    #turbo-config #topic-help { margin:10px 0 0; }
    #turbo-week-message:empty, #topic-message:empty { display:none; }
    #turbo-week-message:not(:empty), #topic-message:not(:empty) {
      margin:10px 0 0; padding:8px; background:#101626;
      border-radius:7px; font-size:11px; line-height:1.5;
    }
    #turbo-config .setting-history > summary {
      font-size:12px; font-weight:800; line-height:1.5; color:#ffcd70;
    }
    #turbo-config .setting-history table { font-size:10px; margin-top:12px; }
    #turbo-config .setting-history th { background:#464030; padding:9px 4px; }
    #turbo-config .setting-history td { padding:8px 4px; }
    #turbo-config .setting-history tbody tr:nth-child(even) { background:#ffffff09; }
  `;
  root.appendChild(style);
})();

}
