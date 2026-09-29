import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

const cfg=window.SC_CONFIG||{};
const configured=Boolean(cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY);
const supabase=configured?createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true}}):null;

const ORG_KEY='sc_gestion_active_organization';
const AI_ROLES=new Set(['owner','admin','commercial','accounting']);
let session=null,profile=null,prospects=[],activeAgent='prospecting',membership=null,organization=null;

const $=id=>document.getElementById(id);
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,currency='ARS')=>v==null?'—':new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:0}).format(v);
const iconRefresh=()=>window.lucide&&window.lucide.createIcons();

function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(window.__at);window.__at=setTimeout(()=>t.hidden=true,1800)}
function loading(target,text){target.innerHTML='<div class="agent-loading"><span class="loading-orbit"></span><span>'+esc(text)+'</span></div>'}
function errorBox(target,msg){target.innerHTML='<div class="agent-error">'+esc(msg)+'</div>'}
function copy(text){navigator.clipboard.writeText(text).then(()=>toast('Copiado'))}

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
  if(!membership||!organization||!AI_ROLES.has(membership.role)){
    $('agentUserLabel').textContent='Acceso restringido';
    errorBox($('prospectingResults'),'Tu rol no tiene permiso para ejecutar agentes IA en esta empresa.');
    $('prospectingPlaceholder').hidden=true;
    errorBox($('quoteResults'),'Solicitá acceso a un administrador de la empresa.');
    $('quotePlaceholder').hidden=true;
    document.querySelectorAll('form button[type="submit"]').forEach(button=>button.disabled=true);
    return;
  }
  localStorage.setItem(ORG_KEY,organization.id);
  const [pr,ps]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',session.user.id).single(),
    supabase.from('prospects').select('id,business_name,sector,city,need_interest,status').eq('organization_id',organization.id).order('business_name')
  ]);
  profile=pr.data;prospects=ps.data||[];
  $('agentUserLabel').textContent=(profile?.full_name||'Usuario')+' · '+organization.name;
  $('quoteProspect').innerHTML='<option value="">Sin prospecto asociado</option>'+prospects.map(p=>'<option value="'+p.id+'">'+esc(p.business_name)+'</option>').join('');
  iconRefresh();
}

function bind(){
  document.querySelectorAll('[data-agent]').forEach(b=>b.addEventListener('click',()=>setAgent(b.dataset.agent)));
  $('prospectingForm').addEventListener('submit',runProspecting);
  $('quoteForm').addEventListener('submit',runQuote);
  $('clearProspectingBtn').addEventListener('click',()=>{ $('prospectingResults').innerHTML='';$('prospectingPlaceholder').hidden=false });
  $('clearQuoteBtn').addEventListener('click',()=>{ $('quoteResults').innerHTML='';$('quotePlaceholder').hidden=false });
  document.body.addEventListener('click',async e=>{
    const c=e.target.closest('[data-copy]');if(c)copy(decodeURIComponent(c.dataset.copy));
    const a=e.target.closest('[data-add-lead]');if(a)await addLead(JSON.parse(decodeURIComponent(a.dataset.addLead)));
  });
}
function setAgent(agent){
  activeAgent=agent;
  document.querySelectorAll('[data-agent]').forEach(b=>b.classList.toggle('active',b.dataset.agent===agent));
  $('prospectingWorkspace').classList.toggle('active',agent==='prospecting');
  $('quoteWorkspace').classList.toggle('active',agent==='quote');
  $('agentPageTitle').textContent=agent==='prospecting'?'Agente Comercial':'Agente de Presupuestos';
  $('agentPageSub').textContent=agent==='prospecting'?'Encontrá negocios con afinidad real para SC y prepará el primer contacto.':'Transformá un relevamiento en una estimación profesional para revisión interna.';
  iconRefresh();
}

async function runProspecting(e){
  e.preventDefault();
  $('prospectingPlaceholder').hidden=true;
  loading($('prospectingResults'),'Investigando negocios y contrastando fuentes públicas...');
  const f=new FormData(e.target);
  const input={city:f.get('city'),nearby:f.get('nearby'),sectors:f.get('sectors'),limit:Number(f.get('limit')||8),depth:f.get('depth'),notes:f.get('notes')};
  const {data,error}=await supabase.functions.invoke('ai-agent',{body:{organization_id:organization.id,agent_type:'prospecting',input}});
  if(error){errorBox($('prospectingResults'),error.message||'No se pudo ejecutar el agente.');return}
  renderProspecting(data?.result||{});
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
  const {data,error}=await supabase.functions.invoke('ai-agent',{body:{organization_id:organization.id,agent_type:'quote',prospect_id,input}});
  if(error){errorBox($('quoteResults'),error.message||'No se pudo ejecutar el agente.');return}
  renderQuote(data?.result||{},prospect_id,input);
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

init();
