import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createHandler } from './handler.js';
const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(createHandler({
 clientForToken:(token:string)=>createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}}),
 adminClient:createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
}));
