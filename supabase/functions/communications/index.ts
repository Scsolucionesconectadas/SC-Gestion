import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const DEFAULT_ORIGINS = [
  'https://app.scsolucionesconectadas.com.ar',
  'https://scsolucionesconectadas.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
];
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function origins(){return new Set([...DEFAULT_ORIGINS,...(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(value=>value.trim()).filter(Boolean)])}
function cors(origin:string){return {'Access-Control-Allow-Origin':origins().has(origin)?origin:DEFAULT_ORIGINS[0],'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function json(payload:unknown,status:number,headers:Record<string,string>){return new Response(JSON.stringify(payload),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
function base64(bytes:Uint8Array){let binary='';const chunk=0x8000;for(let index=0;index<bytes.length;index+=chunk)binary+=String.fromCharCode(...bytes.subarray(index,index+chunk));return btoa(binary)}

Deno.serve(async request=>{
  const origin=request.headers.get('Origin')||'',headers=cors(origin);
  if(origin&&!origins().has(origin))return json({error:'Origin not allowed'},403,headers);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json({error:'Method not allowed'},405,headers);
  if(Number(request.headers.get('content-length')||0)>50_000)return json({error:'Request too large'},413,headers);

  const supabaseUrl=Deno.env.get('SUPABASE_URL'),publishableKey=Deno.env.get('SUPABASE_ANON_KEY');
  if(!supabaseUrl||!publishableKey)return json({error:'Service unavailable'},503,headers);
  const authHeader=request.headers.get('Authorization')||'';
  const supabase=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await supabase.auth.getUser();
  if(userError||!userData.user)return json({error:'Unauthorized'},401,headers);

  let body:any;try{body=await request.json()}catch{return json({error:'Invalid JSON body'},400,headers)}
  const action=String(body?.action||'send'),organizationId=String(body?.organization_id||'');
  if(action==='connection_status'){
    if(!UUID_PATTERN.test(organizationId))return json({error:'Invalid organization'},400,headers);
    const {data:allowed}=await supabase.rpc('current_user_has_permission',{target_organization_id:organizationId,requested_permission:'communications.send'});
    if(!allowed)return json({error:'Forbidden'},403,headers);
    return json({configured:Boolean(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('RESEND_FROM'))},200,headers);
  }
  const messageId=String(body?.message_id||'');
  if(!UUID_PATTERN.test(messageId))return json({error:'Invalid message'},400,headers);

  const {data:message,error:messageError}=await supabase.from('email_messages').select('*').eq('id',messageId).maybeSingle();
  if(messageError||!message)return json({error:'Message not found'},404,headers);
  const {data:allowed}=await supabase.rpc('current_user_has_permission',{target_organization_id:message.organization_id,requested_permission:'communications.send'});
  if(!allowed)return json({error:'Forbidden'},403,headers);
  if(message.status==='sent')return json({message_id:message.id,status:'sent',provider_id:message.provider_id},200,headers);

  const resendKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('RESEND_FROM');
  if(!resendKey||!from){
    await supabase.from('email_messages').update({status:'failed',error_message:'Email provider is not configured'}).eq('id',message.id);
    return json({error:'Email provider is not configured'},503,headers);
  }
  if(!Array.isArray(message.to_addresses)||message.to_addresses.length<1||message.to_addresses.length>20)return json({error:'Invalid recipients'},400,headers);

  const oneHourAgo=new Date(Date.now()-60*60*1000).toISOString();
  const {count}=await supabase.from('email_messages').select('id',{count:'exact',head:true}).eq('organization_id',message.organization_id).eq('created_by',userData.user.id).eq('status','sent').gte('sent_at',oneHourAgo);
  if((count||0)>=100)return json({error:'Hourly usage limit reached'},429,headers);

  const attachments=[];let attachmentBytes=0;
  for(const path of message.attachment_paths||[]){
    if(typeof path!=='string'||!path.startsWith(message.organization_id+'/'))return json({error:'Invalid attachment path'},400,headers);
    const {data:file,error}=await supabase.storage.from('generated-pdfs').download(path);
    if(error||!file)return json({error:'Could not load an attachment'},422,headers);
    const bytes=new Uint8Array(await file.arrayBuffer());attachmentBytes+=bytes.length;
    if(attachmentBytes>10*1024*1024)return json({error:'Attachments are too large'},413,headers);
    attachments.push({filename:path.split('/').pop()||'documento.pdf',content:base64(bytes)});
  }

  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':message.id},body:JSON.stringify({from,to:message.to_addresses,cc:message.cc_addresses?.length?message.cc_addresses:undefined,subject:message.subject,html:message.html_body,text:message.text_body||undefined,reply_to:Deno.env.get('RESEND_REPLY_TO')||undefined,attachments}) ,signal:AbortSignal.timeout(30_000)});
    const result=await response.json();
    if(!response.ok)throw new Error(result?.message||'Email provider rejected the request');
    await supabase.from('email_messages').update({status:'sent',provider_id:result.id||null,error_message:null,sent_at:new Date().toISOString()}).eq('id',message.id);
    return json({message_id:message.id,status:'sent',provider_id:result.id||null},200,headers);
  }catch(error){
    const internal=error instanceof Error?error.message:String(error);console.error('communications send failed',{message_id:message.id,message:internal});
    await supabase.from('email_messages').update({status:'failed',error_message:internal.slice(0,500)}).eq('id',message.id);
    return json({error:'The email could not be sent',message_id:message.id},502,headers);
  }
});
