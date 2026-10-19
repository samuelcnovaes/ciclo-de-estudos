export function createHandler({clientForToken,adminClient,origin='https://samuelcnovaes.github.io'}) {
 return async req=>{
  const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return respond({error:'Origem não permitida.'},403);
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return respond({error:'Método não permitido.'},405);
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');if(!token)return respond({error:'Entre na sua conta.'},401);
  try{
   const client=clientForToken(token),{data,error}=await client.auth.getUser(token);if(error||!data?.user)return respond({error:'Sessão inválida. Entre novamente.'},401);
   const access=await client.from('platform_access').select('role,active').eq('user_id',data.user.id).maybeSingle();const platformAdmin=!access.error&&access.data?.active&&access.data.role==='admin';let performanceAdmin=false;if(!platformAdmin){const permission=await client.from('performance_access').select('role,active').eq('user_id',data.user.id).maybeSingle();performanceAdmin=!permission.error&&permission.data?.active&&permission.data.role==='admin';}if(!platformAdmin&&!performanceAdmin)return respond({error:'Apenas administradores podem cadastrar contas.'},403);
   const body=await req.json();const email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim();const password=body.password;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>120||typeof password!=='string'||password.length<8||password.length>72||typeof body.cycle!=='boolean'||typeof body.performance!=='boolean')return respond({error:'Informe nome, e-mail, senha de 8 a 72 caracteres e os acessos.'},400);
   if(!platformAdmin&&(!body.cycle||!body.performance))return respond({error:'Administradores do Desempenho só podem criar contas com acesso ao Desempenho e acesso comum ao Planejamento.'},403);
   const created=await adminClient.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{first_name:name}});if(created.error)return respond({error:created.error.code==='email_exists'||created.error.code==='user_already_exists'?'Esta conta já existe. Use a opção de conceder acesso.':'Não foi possível cadastrar a conta. Confira os dados.'},400);
   const warnings=[];const steps=platformAdmin?[[body.cycle?'grant':'revoke','cycle'],...(body.performance?[['grant','performance']]:[]),['created','cycle']]:[['grant','performance']];for(const [action,app] of steps){const result=await client.rpc(platformAdmin?'platform_manage_access':'performance_manage_access',platformAdmin?{request_action:action,target_email:email,target_app:app}:{request_action:action,target_email:email});if(result.error)warnings.push('A conta foi criada; confira o acesso a '+(app==='cycle'?'Planejamento':'Desempenho')+' no painel.')}
   return respond({user_id:created.data.user.id,email,warning:[...new Set(warnings)].join(' ')},201);
  }catch{return respond({error:'Não foi possível concluir o cadastro. Verifique o painel antes de tentar novamente.'},500)}
 };
}
