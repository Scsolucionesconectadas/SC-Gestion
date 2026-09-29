import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

const cfg=window.SC_CONFIG||{};
const configured=Boolean(cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY);
const supabase=configured?createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true}}):null;

const ORG_KEY='sc_gestion_active_organization';
const FALLBACK_MODELS=['gpt-6-luna','gpt-6-sol','gpt-6-astra','gpt-5.4-mini','gpt-5-mini'];
const MODEL_LABELS={
  'gpt-6-luna':'GPT-6 Luna · eficiente',
  'gpt-6-sol':'GPT-6 Sol · equilibrado',
  'gpt-6-astra':'GPT-6 Astra · máxima calidad',
  'gpt-5.4-mini':'GPT-5.4 Mini · rápido',
  'gpt-5-mini':'GPT-5 Mini · compatible'
};
let session=null,profile=null,prospects=[],definitions=[],activeAgent='prospecting',membership=null,organization=null,canRun=false,canManage=false,studioAgentId=null,connection=null;

const $=id=>document.getElementById(id);
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,currency='ARS')=>v==null?'—':new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:0}).format(v);
const iconRefresh=()=>window.lucide&&window.lucide.createIcons();

function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(window.__at);window.__at=setTimeout(()=>t.hidden=true,1800)}
function loading(target,text){target.innerHTML='<div class="agent-loading"><span class="loading-orbit"></span><span>'+esc(text)+'</span></div>'}
function errorBox(target,msg){target.innerHTML='<div class="agent-error">'+esc(msg)+'</div>'}
function copy(text){navigator.clipboard.writeText(text).then(()=>toast('Copiado'))}

async function functionErrorMessage(error){
  let payload=null;
  try{
    if(error?.context instanceof Response)payload=await error.context.clone().json();
  }catch{}
  return payload?.message||payload?.error||error?.message||'No se pudo completar la solicitud.';
}

async function invokeAgent(body){
  const {data,error}=await supabase.functions.invoke('ai-agent',{body});
  if(error)throw new Error(await functionErrorMessage(error));
  return data;
}

async function loadConnectionStatus(){
  if(!canManage)return;
  try{
    connection=await invokeAgent({action:'connection_status',organization_id:organization.id});
  }catch(error){
    connection={configured:false,connected:false,message:error.message,allowed_models:FALLBACK_MODELS,available_models:[]};
  }
  renderConnectionStatus();
}

function renderConnectionStatus(){
  const target=$('agentConnectionStatus');if(!target)return;
  const label=connection?.account?.label;
  target.className='agent-provider '+(connection?.connected?'is-connected':'is-pending');
  target.innerHTML='<span></span><div><b>'+(connection?.connected?'OpenAI conectado':'OpenAI pendiente')+'</b><small>'+esc(connection?.connected?(label||'Cuenta sin identificar'):'Configuración requerida')+'</small></div>';
}

function modelOptions(selected){
  const available=Array.isArray(connection?.available_models)&&connection.available_models.length?connection.available_models:connection?.allowed_models;
  const models=[...new Set([...(Array.isArray(available)?available:FALLBACK_MODELS),selected].filter(Boolean))];
  return models.map(model=>'<option value="'+esc(model)+'" '+(model===selected?'selected':'')+'>'+esc(MODEL_LABELS[model]||model)+'</option>').join('');
}

function connectionBanner(){
  const account=connection?.account||{};
  const details=[account.label,account.project_id].filter(Boolean).join(' · ');
  return '<section class="studio-connection '+(connection?.connected?'is-connected':'is-pending')+'"><span class="studio-connection-icon"><i data-lucide="'+(connection?.connected?'badge-check':'unplug')+'"></i></span><div><b>'+(connection?.connected?'Conexión OpenAI verificada':'OpenAI requiere configuración')+'</b><p>'+esc(connection?.connected?(details||'La credencial funciona, pero falta identificar la cuenta operativa.'):(connection?.message||'Falta la credencial de proyecto en el servidor.'))+'</p></div><a class="btn btn-secondary" href="./index.html?view=settings&tab=integrations"><i data-lucide="settings-2"></i>'+(connection?.connected?'Ver integración':'Configurar')+'</a></section>';
}

async function init(){
  bind();
  if(!configured){
    $('agentUserLabel').textContent='Supabase pendiente';
    errorBox($('prospectingResults'),'El CRM todavía no tiene configuradas las claves públicas de Supabase.');
    $('prospectingPlaceholder').hidden=true;
    errorBox($('quoteResults'),'El CRM todavía no tiene configuradas las claves públicas de Supabase.');
    $('quotePlaceholder').hidden=true;
    return;
  }
  const {data}=await supabase.auth.getSession();session=data.session;
  if(!session){location.href='./index.html';return}
  const memberships=await supabase.from('memberships').select('organization_id,role,active,organizations(id,name,slug,status)').eq('user_id',session.user.id).eq('active',true);
  const stored=localStorage.getItem(ORG_KEY);
  membership=(memberships.data||[]).find(item=>item.organization_id===stored)||(memberships.data||[])[0]||null;
  organization=membership?.organizations||null;
  if(!membership||!organization){
    $('agentUserLabel').textContent='Acceso restringido';
    errorBox($('prospectingResults'),'Tu usuario no pertenece a una empresa activa.');
    $('prospectingPlaceholder').hidden=true;
    errorBox($('quoteResults'),'Solicitá acceso a un administrador de la empresa.');
    $('quotePlaceholder').hidden=true;
    document.querySelectorAll('form button[type="submit"]').forEach(button=>button.disabled=true);
    return;
  }
  localStorage.setItem(ORG_KEY,organization.id);
  const [pr,ps,agents,runPermission,managePermission]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',session.user.id).single(),
    supabase.from('prospects').select('id,business_name,sector,city,need_interest,status').eq('organization_id',organization.id).order('business_name'),
    supabase.from('agent_definitions').select('*').eq('organization_id',organization.id).neq('status','archived').order('name'),
    supabase.rpc('current_user_has_permission',{target_organization_id:organization.id,requested_permission:'agents.run'}),
    supabase.rpc('current_user_has_permission',{target_organization_id:organization.id,requested_permission:'agents.manage'})
  ]);
  profile=pr.data;prospects=ps.data||[];definitions=agents.data||[];canRun=runPermission.data===true;canManage=managePermission.data===true;
  if(!canRun){
    errorBox($('prospectingResults'),'Tu rol no tiene permiso para ejecutar agentes IA en esta empresa.');
    $('prospectingPlaceholder').hidden=true;document.querySelectorAll('form button[type="submit"]').forEach(button=>button.disabled=true);
  }
  $('agentUserLabel').textContent=canRun
    ?(profile?.full_name||'Usuario')+' · '+organization.name
    :'Acceso restringido · '+organization.name;
  $('quoteProspect').innerHTML='<option value="">Sin prospecto asociado</option>'+prospects.map(p=>'<option value="'+p.id+'">'+esc(p.business_name)+'</option>').join('');
  $('agentStudioBtn').hidden=!canManage;$('newAgentBtn').hidden=!canManage;
  $('agentConnectionStatus').hidden=!canManage;
  await loadConnectionStatus();
  renderAgentSelector();
  if(!definitions.some(item=>item.slug===activeAgent))activeAgent=definitions[0]?.slug||'prospecting';
  setAgent(activeAgent);
  iconRefresh();
}

function bind(){
  $('prospectingForm').addEventListener('submit',runProspecting);
  $('quoteForm').addEventListener('submit',runQuote);
  $('genericAgentForm').addEventListener('submit',runGenericAgent);
  $('clearProspectingBtn').addEventListener('click',()=>{ $('prospectingResults').innerHTML='';$('prospectingPlaceholder').hidden=false });
  $('clearQuoteBtn').addEventListener('click',()=>{ $('quoteResults').innerHTML='';$('quotePlaceholder').hidden=false });
  $('clearGenericBtn').addEventListener('click',()=>{ $('genericResults').innerHTML='';$('genericPlaceholder').hidden=false });
  $('agentStudioBtn').addEventListener('click',()=>openStudio());
  $('newAgentBtn').addEventListener('click',()=>openStudio(null,true));
  $('studioNewAgentBtn').addEventListener('click',()=>editStudioAgent(null));
  document.querySelectorAll('[data-agent-close]').forEach(button=>button.addEventListener('click',closeStudio));
  $('agentStudioModal').addEventListener('click',event=>{if(event.target===$('agentStudioModal'))closeStudio()});
  document.body.addEventListener('click',async e=>{
    const selector=e.target.closest('[data-agent]');if(selector){setAgent(selector.dataset.agent);return}
    const c=e.target.closest('[data-copy]');if(c)copy(decodeURIComponent(c.dataset.copy));
    const a=e.target.closest('[data-add-lead]');if(a)await addLead(JSON.parse(decodeURIComponent(a.dataset.addLead)));
    const studio=e.target.closest('[data-studio-agent]');if(studio)editStudioAgent(studio.dataset.studioAgent);
    const publish=e.target.closest('[data-publish-agent]');if(publish)await publishAgent(publish.dataset.publishAgent);
    const archive=e.target.closest('[data-archive-agent]');if(archive)await archiveAgent(archive.dataset.archiveAgent);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('agentStudioModal').hidden)closeStudio()});
}
function renderAgentSelector(){
  $('agentSelector').innerHTML=definitions.map(agent=>'<button type="button" class="'+(agent.slug===activeAgent?'active':'')+'" data-agent="'+esc(agent.slug)+'"><i data-lucide="'+(agent.slug==='prospecting'?'radar':agent.slug==='quote'?'calculator':'bot')+'"></i><span><b>'+esc(agent.name)+'</b><small>'+esc(agent.description||'Agente configurable')+'</small></span><em>v'+Number(agent.current_version||0)+'</em></button>').join('');
  iconRefresh();
}
function setAgent(agent){
  activeAgent=agent;
  document.querySelectorAll('[data-agent]').forEach(b=>b.classList.toggle('active',b.dataset.agent===agent));
  $('prospectingWorkspace').classList.toggle('active',agent==='prospecting');
  $('quoteWorkspace').classList.toggle('active',agent==='quote');
  $('genericWorkspace').classList.toggle('active',!['prospecting','quote'].includes(agent));
  const definition=definitions.find(item=>item.slug===agent);
  $('agentPageTitle').textContent=definition?.name||(agent==='prospecting'?'Agente Comercial':'Agente de Presupuestos');
  $('agentPageSub').textContent=definition?.description||(agent==='prospecting'?'Encontrá negocios con afinidad real para SC y prepará el primer contacto.':'Transformá un relevamiento en una estimación profesional para revisión interna.');
  iconRefresh();
}

async function runProspecting(e){
  e.preventDefault();
  $('prospectingPlaceholder').hidden=true;
  loading($('prospectingResults'),'Investigando negocios y contrastando fuentes públicas...');
  const f=new FormData(e.target);
  const input={city:f.get('city'),nearby:f.get('nearby'),sectors:f.get('sectors'),limit:Number(f.get('limit')||8),depth:f.get('depth'),notes:f.get('notes')};
  try{
    const data=await invokeAgent({organization_id:organization.id,agent_type:'prospecting',input});
    renderProspecting(data?.result||{});
  }catch(error){errorBox($('prospectingResults'),error.message||'No se pudo ejecutar el agente.')}
}
function renderProspecting(result){
  const leads=result?.leads||[];
  if(!leads.length){$('prospectingResults').innerHTML='<div class="agent-error">No se recibieron oportunidades estructuradas. Revisá la respuesta del agente o ampliá la búsqueda.</div>';return}
  $('prospectingResults').innerHTML=(result.summary?'<div class="quote-block"><h4>Resumen</h4><div style="font-size:10px;line-height:1.6">'+esc(result.summary)+'</div></div>':'')+leads.map(lead=>{
    const facts=(lead.verified_facts||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
    const hyps=(lead.opportunity_hypotheses||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
    const sources=(lead.sources||[]).filter(Boolean).map((u,i)=>'<a target="_blank" rel="noopener" href="'+esc(u)+'">Fuente '+(i+1)+'</a>').join('');
    const contact=lead.public_contact||{};
    const encoded=encodeURIComponent(JSON.stringify(lead));
    return '<article class="lead-result"><div class="lead-result-head"><div><h4>'+esc(lead.business_name)+'</h4><div class="meta">'+esc(lead.sector||'Sin rubro')+' · '+esc(lead.city||'')+'</div></div><span class="status-pill '+(lead.fit==='alto'?'status-green':lead.fit==='medio'?'status-amber':'status-gray')+'">Afinidad '+esc(lead.fit||'—')+'</span></div>'+
      '<div class="lead-section"><b>Contacto público</b><div class="meta">'+esc([contact.contact_name,contact.phone,contact.email,contact.website].filter(Boolean).join(' · ')||'Sin datos confirmados')+'</div></div>'+
      (facts?'<div class="lead-section"><b>Hechos verificados</b><ul>'+facts+'</ul></div>':'')+
      (hyps?'<div class="lead-section"><b>Hipótesis de oportunidad</b><ul>'+hyps+'</ul></div>':'')+
      '<div class="lead-section"><b>Ángulo sugerido</b><div class="meta">'+esc(lead.suggested_solution_angle||'')+'</div></div>'+
      '<div class="draft-message">'+esc(lead.message_draft||'')+'</div>'+
      '<div class="source-links">'+sources+'</div>'+
      '<div class="lead-actions"><button type="button" class="btn btn-primary" data-add-lead="'+encoded+'">Agregar al CRM</button><button type="button" class="copy-btn" data-copy="'+encodeURIComponent(lead.message_draft||'')+'">Copiar mensaje</button></div></article>';
  }).join('');
  iconRefresh();
}
async function addLead(lead){
  const c=lead.public_contact||{};
  const payload={
    organization_id:organization.id,
    business_name:lead.business_name,
    sector:lead.sector||null,
    city:lead.city||null,
    contact_name:c.contact_name||null,
    phone:c.phone||null,
    email:c.email||null,
    need_interest:(lead.opportunity_hypotheses||[]).join(' | ')||lead.suggested_solution_angle||null,
    brand:'SC',
    status:'Prospecto',
    next_action:'Revisar y contactar',
    notes:'Sugerido por Agente Comercial. Afinidad: '+(lead.fit||'—')+'. '+(lead.fit_reason||''),
    source:'Agente IA',
    owner_id:profile.id,
    created_by:profile.id
  };
  const {error}=await supabase.from('prospects').insert(payload);
  if(error){toast('No se pudo agregar: '+error.message);return}
  toast('Prospecto agregado al CRM');
}

async function runQuote(e){
  e.preventDefault();
  $('quotePlaceholder').hidden=true;
  loading($('quoteResults'),'Analizando alcance, precios internos y costos recurrentes...');
  const f=new FormData(e.target);
  const input={
    requirements:f.get('requirements'),
    users:f.get('users')?Number(f.get('users')):null,
    deadline:f.get('deadline')||null,
    integrations:f.get('integrations')||null,
    include_hosting:f.get('hosting')==='on',
    include_maintenance:f.get('maintenance')==='on',
    research_hosting_market:f.get('research_hosting_market')==='on'
  };
  const prospect_id=f.get('prospect_id')||null;
  try{
    const data=await invokeAgent({organization_id:organization.id,agent_type:'quote',prospect_id,input});
    renderQuote(data?.result||{},prospect_id,input);
  }catch(error){errorBox($('quoteResults'),error.message||'No se pudo ejecutar el agente.')}
}
function renderQuote(q,prospectId,input){
  if(q.raw_text){$('quoteResults').innerHTML='<div class="quote-block"><pre style="white-space:pre-wrap;font-size:10px">'+esc(q.raw_text)+'</pre></div>';return}
  const one=q.one_time_items||[],rec=q.recurring_items||[];
  const list=(arr,recurring=false)=>arr.map(x=>'<div class="quote-line"><span>'+esc(x.item)+'<small>'+esc((x.quantity||1)+' × '+(x.unit||x.billing_cycle||'unidad')+' · '+(x.source||''))+'</small></span><b>'+money(x.subtotal??x.unit_price,q.recommended_range?.currency||'ARS')+'</b></div>').join('');
  const missing=(q.missing_pricing_inputs||[]);
  const assumptions=(q.assumptions||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
  const risks=(q.risks||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
  const questions=(q.client_questions||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
  const payload=encodeURIComponent(JSON.stringify({prospectId,input,q}));
  $('quoteResults').innerHTML=
    '<section class="quote-hero"><h3>'+esc(q.title||'Estimación SC')+'</h3><p>'+esc(q.executive_summary||'')+'</p><div class="quote-totals"><div class="quote-total"><span>Implementación</span><strong>'+money(q.one_time_total,q.recommended_range?.currency||'ARS')+'</strong></div><div class="quote-total"><span>Mensual estimado</span><strong>'+money(q.monthly_total,q.recommended_range?.currency||'ARS')+'</strong></div></div></section>'+
    (q.requires_pricing_input?'<div class="warning-box"><b>Requiere completar precios internos.</b><br>'+esc(missing.join(' · ')||'El agente detectó datos faltantes antes de cerrar un valor.')+'</div>':'')+
    '<section class="quote-block"><h4>Costos únicos</h4>'+(one.length?list(one):'<div class="meta">Sin ítems calculados.</div>')+'</section>'+
    '<section class="quote-block"><h4>Costos recurrentes</h4>'+(rec.length?list(rec,true):'<div class="meta">Sin ítems recurrentes.</div>')+'</section>'+
    (assumptions?'<section class="quote-block"><h4>Supuestos</h4><ul style="font-size:10px;line-height:1.6">'+assumptions+'</ul></section>':'')+
    (risks?'<section class="quote-block"><h4>Riesgos / variaciones</h4><ul style="font-size:10px;line-height:1.6">'+risks+'</ul></section>':'')+
    (questions?'<section class="quote-block"><h4>Preguntas para el cliente</h4><ul style="font-size:10px;line-height:1.6">'+questions+'</ul></section>':'')+
    '<div class="lead-actions"><button type="button" class="btn btn-primary" id="saveEstimateBtn">Guardar borrador</button><button type="button" class="copy-btn" data-copy="'+encodeURIComponent(JSON.stringify(q,null,2))+'">Copiar JSON</button></div>';
  $('saveEstimateBtn').onclick=()=>saveEstimate(q,prospectId,input);
}
async function saveEstimate(q,prospectId,input){
  const currency=q.recommended_range?.currency||'ARS';
  const {error}=await supabase.from('quote_estimates').insert({
    organization_id:organization.id,
    prospect_id:prospectId||null,
    created_by:profile.id,
    title:q.title||'Estimación SC',
    requirements:input,
    estimate:q,
    currency,
    one_time_total:q.one_time_total||null,
    recurring_monthly_total:q.monthly_total||null,
    status:'draft'
  });
  if(error){toast('No se pudo guardar: '+error.message);return}
  toast('Borrador guardado');
}

async function runGenericAgent(event){
  event.preventDefault();const definition=definitions.find(item=>item.slug===activeAgent);if(!definition)return;
  $('genericPlaceholder').hidden=true;loading($('genericResults'),'Ejecutando la versión publicada y registrando trazabilidad...');
  const values=new FormData(event.target),input={request:values.get('request').trim(),context:values.get('context').trim()||null};
  try{
    const data=await invokeAgent({organization_id:organization.id,agent_id:definition.id,input});
    const result=data?.result||{};
    $('genericResults').innerHTML='<section class="quote-hero"><span class="status-pill status-green">Ejecución registrada</span><h3>'+esc(result.summary||definition.name)+'</h3><p class="agent-result-text">'+esc(result.result_markdown||JSON.stringify(result,null,2))+'</p></section>'+((result.next_actions||[]).length?'<section class="quote-block"><h4>Próximas acciones</h4><ul>'+result.next_actions.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul></section>':'')+((result.warnings||[]).length?'<div class="warning-box"><b>Revisión humana</b><br>'+esc(result.warnings.join(' · '))+'</div>':'');
    iconRefresh();
  }catch(error){errorBox($('genericResults'),error.message||'No se pudo ejecutar el agente.')}
}

function openStudio(agentId=null,create=false){
  if(!canManage)return;$('agentStudioModal').hidden=false;document.body.classList.add('studio-open');renderStudioList();
  editStudioAgent(create?null:(agentId||definitions.find(item=>item.slug===activeAgent)?.id||definitions[0]?.id||null));
}
function closeStudio(){$('agentStudioModal').hidden=true;document.body.classList.remove('studio-open')}
function renderStudioList(){
  $('studioAgentList').innerHTML=definitions.length?definitions.map(agent=>'<button type="button" class="'+(studioAgentId===agent.id?'active':'')+'" data-studio-agent="'+agent.id+'"><span><b>'+esc(agent.name)+'</b><small>'+esc(agent.slug)+' · v'+Number(agent.current_version||0)+'</small></span><span class="status-pill '+(agent.status==='active'?'status-green':'status-amber')+'">'+(agent.status==='active'?'Publicado':'Borrador')+'</span></button>').join(''):'<div class="agent-error">Todavía no hay agentes.</div>';
}
async function editStudioAgent(agentId){
  studioAgentId=agentId||null;renderStudioList();const agent=definitions.find(item=>item.id===studioAgentId)||null;
  const versions=agent?await supabase.from('agent_versions').select('id,version,published_at,published_by').eq('organization_id',organization.id).eq('agent_id',agent.id).order('version',{ascending:false}).limit(12):{data:[]};
  const tools=Array.isArray(agent?.tools)?agent.tools:[],sources=Array.isArray(agent?.context_sources)?agent.context_sources:[];
  $('studioEditor').innerHTML='<form id="agentDefinitionForm" class="agent-definition-form"><input type="hidden" name="id" value="'+esc(agent?.id||'')+'"><div class="studio-editor-head"><div><span class="eyebrow">'+(agent?'BORRADOR DE CONFIGURACIÓN':'NUEVO AGENTE')+'</span><h3>'+(agent?esc(agent.name):'Definí un asistente especializado')+'</h3></div>'+(agent?'<span class="status-pill '+(agent.status==='active'?'status-green':'status-amber')+'">'+(agent.status==='active'?'Publicado v'+agent.current_version:'Borrador')+'</span>':'')+'</div><div class="studio-fields"><label>Nombre<input name="name" required minlength="2" maxlength="120" value="'+esc(agent?.name||'')+'" placeholder="Ej.: Analista de proyectos"></label><label>Identificador<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" '+(agent?'readonly':'')+' value="'+esc(agent?.slug||'')+'" placeholder="analista-proyectos"></label><label class="full">Descripción<input name="description" maxlength="300" value="'+esc(agent?.description||'')+'" placeholder="Qué resuelve y para quién."></label><label class="full">Prompt del sistema<textarea name="instructions" required minlength="20" maxlength="20000" rows="10" placeholder="Rol, objetivo, reglas, límites y formato esperado.">'+esc(agent?.instructions||'')+'</textarea><small>Los secretos y claves nunca deben incluirse en el prompt.</small></label><label>Modelo autorizado<input name="model" list="modelOptions" value="'+esc(agent?.model||'gpt-5-mini')+'"><datalist id="modelOptions"><option value="gpt-5-mini"></datalist><small>También debe estar permitido en OPENAI_ALLOWED_MODELS.</small></label><label class="approval-control">Aprobación humana<span class="toggle-field"><input name="requires_approval" type="checkbox" '+(agent?.requires_approval!==false?'checked':'')+'><span></span><b>Requerida</b></span></label></div><div class="studio-options"><fieldset><legend>Herramientas</legend><label class="check-row"><input type="checkbox" name="web_search" '+(tools.includes('web_search')?'checked':'')+'><span>Búsqueda web pública</span></label></fieldset><fieldset><legend>Fuentes internas</legend><label class="check-row"><input type="checkbox" name="prospects" '+(sources.includes('prospects')?'checked':'')+'><span>Oportunidades</span></label><label class="check-row"><input type="checkbox" name="pricing_catalog" '+(sources.includes('pricing_catalog')?'checked':'')+'><span>Catálogo de precios</span></label></fieldset></div><div class="studio-history"><div><b>Versiones publicadas</b><small>Historial inmutable para auditoría</small></div><div class="version-list">'+((versions.data||[]).length?(versions.data||[]).map(version=>'<span><b>v'+version.version+'</b><small>'+new Date(version.published_at).toLocaleString('es-AR')+'</small></span>').join(''):'<span><small>Sin versiones publicadas.</small></span>')+'</div></div><div class="form-actions">'+(agent?'<button type="button" class="btn btn-secondary danger-soft" data-archive-agent="'+agent.id+'"><i data-lucide="archive"></i>Archivar</button>':'')+'<span class="form-actions-spacer"></span><button type="button" class="btn btn-secondary" data-agent-close>Cancelar</button><button class="btn btn-secondary" type="submit"><i data-lucide="save"></i>Guardar borrador</button>'+(agent?'<button type="button" class="btn btn-primary" data-publish-agent="'+agent.id+'"><i data-lucide="rocket"></i>Publicar versión</button>':'')+'</div></form>';
  const selectedModel=agent?.model||'gpt-5-mini';
  const modelField=$('studioEditor').querySelector('input[name="model"]');
  modelField.closest('label').innerHTML='Modelo autorizado<select name="model" required>'+modelOptions(selectedModel)+'</select><small>La lista se valida contra los modelos habilitados en el servidor.</small>';
  $('agentDefinitionForm').insertAdjacentHTML('afterbegin',connectionBanner());
  $('agentDefinitionForm').onsubmit=saveAgentDefinition;$('studioEditor').querySelectorAll('[data-agent-close]').forEach(button=>button.onclick=closeStudio);iconRefresh();
}
async function saveAgentDefinition(event){
  event.preventDefault();const values=new FormData(event.target),id=values.get('id')||null;
  const payload={organization_id:organization.id,slug:values.get('slug').trim().toLowerCase(),name:values.get('name').trim(),description:values.get('description').trim()||null,instructions:values.get('instructions').trim(),model:values.get('model').trim()||'gpt-5-mini',tools:values.get('web_search')==='on'?['web_search']:[],context_sources:['prospects','pricing_catalog'].filter(key=>values.get(key)==='on'),requires_approval:values.get('requires_approval')==='on',updated_by:profile.id};
  const result=id?await supabase.from('agent_definitions').update(payload).eq('organization_id',organization.id).eq('id',id).select('*').single():await supabase.from('agent_definitions').insert({...payload,status:'draft',created_by:profile.id}).select('*').single();
  if(result.error){toast(result.error.message);return}
  await reloadDefinitions();studioAgentId=result.data.id;await editStudioAgent(result.data.id);toast('Borrador guardado');
}
async function publishAgent(agentId){
  const {data,error}=await supabase.rpc('publish_agent_definition',{target_agent_id:agentId});if(error){toast(error.message);return}
  await reloadDefinitions();await editStudioAgent(agentId);toast('Versión '+data+' publicada');
}
async function archiveAgent(agentId){
  if(!confirm('¿Archivar este agente? Dejará de estar disponible para nuevas ejecuciones.'))return;
  const {error}=await supabase.from('agent_definitions').update({status:'archived',updated_by:profile.id}).eq('organization_id',organization.id).eq('id',agentId);if(error){toast(error.message);return}
  await reloadDefinitions();studioAgentId=definitions[0]?.id||null;if(studioAgentId)await editStudioAgent(studioAgentId);else $('studioEditor').innerHTML='<div class="agent-error">No hay agentes activos.</div>';toast('Agente archivado');
}
async function reloadDefinitions(){
  const {data,error}=await supabase.from('agent_definitions').select('*').eq('organization_id',organization.id).neq('status','archived').order('name');if(error){toast(error.message);return}
  definitions=data||[];renderAgentSelector();
}

init();
