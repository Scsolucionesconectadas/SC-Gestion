const app=window.SC_APP;
const $=id=>document.getElementById(id);
const {esc,money,fmtDate,fmtDateTime,initials}=app.format;

let currentClientId=null;
let applyingSavedView=false;
let selectedSavedViewId='';
const appliedDefaults=new Set();

const activeClients=()=>app.data.clients.filter(item=>item.status==='active'&&!item.merged_into_id);
const clientById=id=>app.data.clients.find(item=>item.id===id);
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const currentUserId=()=>app.currentUser?.id||app.currentProfile?.id||'demo-maikol';
const statusLabel=value=>({planned:'Planificado',in_progress:'En curso',paused:'Pausado',completed:'Completado',cancelled:'Cancelado',draft:'Borrador',sent:'Enviado',accepted:'Aceptado',rejected:'Rechazado',issued:'Emitido',partial:'Pago parcial',paid:'Pagado',pending:'Pendiente',approved:'Aprobado',completada:'Completada'}[value]||value||'Sin estado');

function savedViews(){
  return (app.data.pipelineSavedViews||[]).filter(item=>item.user_id===currentUserId());
}

function renderSavedViews(){
  const select=$('pipelineSavedViewSelect');
  if(!select)return;
  const views=savedViews().slice().sort((a,b)=>Number(b.is_default)-Number(a.is_default)||a.name.localeCompare(b.name));
  select.innerHTML='<option value="">Vista actual</option>'+views.map(item=>'<option value="'+item.id+'">'+(item.is_default?'★ ':'')+esc(item.name)+'</option>').join('');
  if(views.some(item=>item.id===selectedSavedViewId))select.value=selectedSavedViewId;
  else selectedSavedViewId='';
  $('pipelineDeleteViewBtn').disabled=!selectedSavedViewId;

  const context=(app.activeOrganization?.id||'demo')+':'+currentUserId();
  const preferred=views.find(item=>item.is_default);
  if(preferred&&!appliedDefaults.has(context)){
    appliedDefaults.add(context);
    selectedSavedViewId=preferred.id;
    select.value=preferred.id;
    applyingSavedView=true;
    app.applyPipelineFilters(preferred.filters||{});
    applyingSavedView=false;
    $('pipelineDeleteViewBtn').disabled=false;
  }
}

function openSaveView(){
  if(!app.hasPermission('crm.view'))return app.notify('Tu rol no tiene acceso al pipeline.');
  const current=savedViews().find(item=>item.id===selectedSavedViewId);
  $('actionEyebrow').textContent='ORGANIZACIÓN PERSONAL';
  $('actionTitle').textContent=current?'Actualizar vista':'Guardar vista';
  $('actionBody').innerHTML='<form class="action-form" id="pipelineViewForm">'+
    '<label>Nombre<input name="name" maxlength="60" value="'+esc(current?.name||'')+'" required></label>'+
    '<label class="saved-view-default"><input name="is_default" type="checkbox" '+(current?.is_default?'checked':'')+'><span><b>Usar al abrir el pipeline</b><small>Se aplicará solo para tu usuario y esta empresa.</small></span></label>'+
    '<div class="saved-view-preview"><i data-lucide="list-filter"></i><span><b>Filtros actuales</b><small id="savedViewSummary"></small></span></div>'+
    '<div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary" type="submit"><i data-lucide="bookmark-check"></i>Guardar vista</button></div></form>';
  $('savedViewSummary').textContent=filterSummary(app.getPipelineFilters());
  $('pipelineViewForm').addEventListener('submit',saveView);
  app.openModal('actionModal');
}

function filterSummary(filters){
  const labels=[];
  if(filters.search)labels.push('búsqueda');
  if(filters.owner)labels.push('responsable');
  if(filters.sector)labels.push('rubro');
  if(filters.followup)labels.push('seguimiento');
  if(filters.probability)labels.push('probabilidad');
  if(filters.currency)labels.push('moneda');
  if(filters.outcome&&filters.outcome!=='active')labels.push('resultado');
  return labels.length?labels.join(' · '):'Configuración general del tablero';
}

async function saveView(event){
  event.preventDefault();
  const form=new FormData(event.currentTarget),name=String(form.get('name')||'').trim(),isDefault=form.get('is_default')==='on';
  if(name.length<2)return app.notify('Ingresá un nombre de al menos 2 caracteres.');
  const filters=app.getPipelineFilters();
  if(app.mode==='demo'){
    if(isDefault)app.data.pipelineSavedViews.forEach(item=>{if(item.user_id===currentUserId())item.is_default=false});
    const existing=savedViews().find(item=>item.name.toLowerCase()===name.toLowerCase());
    if(existing)Object.assign(existing,{name,filters,is_default:isDefault,updated_at:new Date().toISOString()});
    else app.data.pipelineSavedViews.unshift({id:crypto.randomUUID(),organization_id:app.activeOrganization?.id||'demo-sc',user_id:currentUserId(),name,filters,is_default:isDefault,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    selectedSavedViewId=(existing||app.data.pipelineSavedViews[0]).id;
    app.closeModal('actionModal');app.saveDemo();renderSavedViews();app.notify('Vista guardada');return;
  }
  const {data,error}=await app.supabase.rpc('save_pipeline_view',{p_organization_id:app.activeOrganization.id,p_name:name,p_filters:filters,p_is_default:isDefault});
  if(error)return app.notify('No se pudo guardar: '+error.message);
  selectedSavedViewId=data?.id||'';
  app.closeModal('actionModal');await app.reload();renderSavedViews();app.notify('Vista guardada');
}

function openDeleteView(){
  const view=savedViews().find(item=>item.id===selectedSavedViewId);
  if(!view)return;
  $('actionEyebrow').textContent='VISTA PERSONAL';
  $('actionTitle').textContent='Eliminar vista';
  $('actionBody').innerHTML='<section class="confirm-panel"><i data-lucide="trash-2"></i><div><b>'+esc(view.name)+'</b><p>Los filtros guardados se eliminarán únicamente para tu usuario.</p></div></section><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button type="button" class="btn btn-danger" data-confirm-view-delete="'+view.id+'">Eliminar</button></div>';
  app.openModal('actionModal');
}

async function deleteView(id){
  if(app.mode==='demo'){
    app.data.pipelineSavedViews=app.data.pipelineSavedViews.filter(item=>item.id!==id);
    selectedSavedViewId='';app.closeModal('actionModal');app.saveDemo();renderSavedViews();app.notify('Vista eliminada');return;
  }
  const {error}=await app.supabase.from('pipeline_saved_views').delete().eq('id',id).eq('user_id',currentUserId());
  if(error)return app.notify('No se pudo eliminar: '+error.message);
  selectedSavedViewId='';app.closeModal('actionModal');await app.reload();renderSavedViews();app.notify('Vista eliminada');
}

function clientContext(clientId){
  const client=clientById(clientId);
  const family=[client,...app.data.clients.filter(item=>item.merged_into_id===clientId)].filter(Boolean);
  const familyIds=new Set(family.map(item=>item.id));
  const prospectIds=new Set(family.map(item=>item.source_prospect_id).filter(Boolean));
  const projects=app.data.projects.filter(item=>familyIds.has(item.client_id));
  projects.forEach(item=>{if(item.prospect_id)prospectIds.add(item.prospect_id)});
  const projectIds=new Set(projects.map(item=>item.id));
  const proposals=app.data.proposals.filter(item=>familyIds.has(item.converted_client_id)||prospectIds.has(item.prospect_id)||family.some(source=>source.source_proposal_id===item.id));
  const proposalIds=new Set(proposals.map(item=>item.id));
  const tasks=app.data.tasks.filter(item=>projectIds.has(item.project_id)||prospectIds.has(item.prospect_id));
  const documents=app.data.documents.filter(item=>familyIds.has(item.client_id)||projectIds.has(item.project_id));
  const invoices=app.data.invoices.filter(item=>familyIds.has(item.client_id)||projectIds.has(item.project_id));
  const invoiceIds=new Set(invoices.map(item=>item.id));
  const payments=app.data.payments.filter(item=>invoiceIds.has(item.invoice_id));
  const interactions=app.data.interactions.filter(item=>prospectIds.has(item.prospect_id));
  const emails=app.data.emailMessages.filter(item=>(item.related_type==='client'&&familyIds.has(item.related_id))||(item.related_type==='project'&&projectIds.has(item.related_id))||(item.related_type==='proposal'&&proposalIds.has(item.related_id))||(item.related_type==='invoice'&&invoiceIds.has(item.related_id)));
  return {client,family,familyIds,prospectIds,projects,projectIds,proposals,tasks,documents,invoices,payments,interactions,emails};
}

function activityEvents(context){
  const events=[];
  context.interactions.forEach(item=>events.push({date:item.happened_at||item.created_at,icon:'message-circle',kind:'Interacción',title:item.result||item.type,meta:item.next_step||item.notes}));
  context.proposals.forEach(item=>events.push({date:item.sent_at||item.updated_at||item.created_at,icon:'file-check-2',kind:'Propuesta',title:item.document_code||item.title,meta:statusLabel(item.status)+' · '+money(item.amount,item.currency||'ARS')}));
  context.projects.forEach(item=>events.push({date:item.updated_at||item.created_at,icon:'briefcase-business',kind:'Proyecto',title:item.name,meta:statusLabel(item.status)+' · '+Number(item.progress||0)+'%'}));
  context.tasks.forEach(item=>events.push({date:item.updated_at||item.created_at,icon:'list-checks',kind:'Tarea',title:item.title,meta:statusLabel(item.status)+' · '+fmtDateTime(item.due_at)}));
  context.documents.forEach(item=>events.push({date:item.updated_at||item.created_at,icon:'files',kind:'Documento',title:item.title,meta:statusLabel(item.status)}));
  context.invoices.forEach(item=>events.push({date:item.issue_date||item.created_at,icon:'receipt-text',kind:'Comprobante',title:item.internal_number,meta:statusLabel(item.status)+' · '+money(item.total,item.currency)}));
  context.payments.forEach(item=>events.push({date:item.paid_at||item.created_at,icon:'circle-dollar-sign',kind:'Cobro',title:money(item.amount,item.currency),meta:item.reference||item.method}));
  context.emails.forEach(item=>events.push({date:item.sent_at||item.created_at,icon:'mail',kind:'Correo',title:item.subject,meta:statusLabel(item.status)}));
  return events.filter(item=>item.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,40);
}

function balanceLabel(context){
  const totals={};
  context.invoices.filter(item=>!['cancelled'].includes(item.status)).forEach(invoice=>{
    const paid=context.payments.filter(item=>item.invoice_id===invoice.id).reduce((sum,item)=>sum+Number(item.amount||0),0);
    const currency=invoice.currency||'ARS';totals[currency]=(totals[currency]||0)+Math.max(0,Number(invoice.total||0)-paid);
  });
  return Object.entries(totals).map(([currency,total])=>money(total,currency)).join(' · ')||'Sin saldo';
}

function renderClient360(clientId){
  const context=clientContext(clientId),client=context.client;
  if(!client)return app.notify('No se encontró el cliente.');
  currentClientId=clientId;
  const events=activityEvents(context),activeProjects=context.projects.filter(item=>!['completed','cancelled'].includes(item.status));
  const openTasks=context.tasks.filter(item=>item.status!=='completada');
  $('client360Eyebrow').textContent='CLIENTE 360°';
  $('client360Title').textContent=client.business_name;
  $('client360Subtitle').textContent=[client.contact_name,client.city].filter(Boolean).join(' · ')||'Ficha operativa';
  const actions=[
    app.hasPermission('projects.write')?'<button class="btn btn-primary" data-client-action="project"><i data-lucide="folder-plus"></i>Nuevo proyecto</button>':'',
    app.hasPermission('documents.write')?'<button class="btn btn-secondary" data-client-action="document"><i data-lucide="file-plus-2"></i>Documento</button>':'',
    app.hasPermission('billing.write')?'<button class="btn btn-secondary" data-client-action="invoice"><i data-lucide="receipt-text"></i>Comprobante</button>':'',
    app.currentMembership?.role==='owner'&&client.status==='active'?'<button class="btn btn-secondary" data-client-merge><i data-lucide="combine"></i>Unificar</button>':''
  ].join('');
  const timeline=events.length?events.map(item=>'<article class="client-event"><span><i data-lucide="'+item.icon+'"></i></span><div><small>'+esc(item.kind)+' · '+fmtDateTime(item.date)+'</small><b>'+esc(item.title||'Actividad')+'</b><p>'+esc(item.meta||'')+'</p></div></article>').join(''):'<div class="empty-state"><i data-lucide="history"></i><div>Sin actividad vinculada.</div></div>';
  const projectList=context.projects.length?context.projects.slice(0,6).map(item=>'<div class="client-link-row"><span><b>'+esc(item.name)+'</b><small>'+esc(statusLabel(item.status))+' · '+Number(item.progress||0)+'%</small></span><strong>'+fmtDate(item.due_date)+'</strong></div>').join(''):'<p class="client-empty-copy">Sin proyectos vinculados.</p>';
  const merged=context.family.filter(item=>item.id!==client.id);
  $('client360Body').innerHTML='<section class="client360-hero"><span class="client360-avatar">'+esc(initials(client.business_name))+'</span><div><div class="client360-contact"><span><i data-lucide="user-round"></i>'+esc(client.contact_name||'Sin contacto')+'</span><span><i data-lucide="mail"></i>'+esc(client.email||'Sin email')+'</span><span><i data-lucide="phone"></i>'+esc(client.phone||'Sin teléfono')+'</span></div></div><div class="client360-actions">'+actions+'</div></section>'+
    '<section class="client360-kpis"><article><small>Proyectos activos</small><strong>'+activeProjects.length+'</strong></article><article><small>Tareas abiertas</small><strong>'+openTasks.length+'</strong></article><article><small>Saldo operativo</small><strong>'+esc(balanceLabel(context))+'</strong></article><article><small>Documentos</small><strong>'+context.documents.length+'</strong></article></section>'+
    '<div class="client360-layout"><section class="client360-activity"><div class="client-section-head"><div><span class="eyebrow">ACTIVIDAD</span><h3>Historial relacionado</h3></div><span>'+events.length+' registros</span></div><div class="client-timeline">'+timeline+'</div></section>'+
    '<aside class="client360-aside"><section><span class="eyebrow">DATOS</span><dl><div><dt>Identificación</dt><dd>'+esc(client.tax_identifier||'Sin informar')+'</dd></div><div><dt>Dirección</dt><dd>'+esc(client.address||client.city||'Sin informar')+'</dd></div><div><dt>Estado</dt><dd>'+esc(client.status==='active'?'Activo':'Inactivo')+'</dd></div><div><dt>Actualizado</dt><dd>'+fmtDate(client.updated_at||client.created_at)+'</dd></div></dl></section><section><span class="eyebrow">PROYECTOS</span>'+projectList+'</section>'+(merged.length?'<section><span class="eyebrow">UNIFICACIONES</span>'+merged.map(item=>'<div class="client-link-row"><span><b>'+esc(item.business_name)+'</b><small>Registro conservado</small></span><strong>'+fmtDate(item.merged_at)+'</strong></div>').join('')+'</section>':'')+'</aside></div>';
  app.openModal('client360Modal');
  window.lucide?.createIcons();
}

function duplicateScore(source,candidate){
  let score=0;
  const sourceName=normalize(source.business_name),candidateName=normalize(candidate.business_name);
  if(source.tax_identifier&&normalize(source.tax_identifier)===normalize(candidate.tax_identifier))score+=100;
  if(source.email&&normalize(source.email)===normalize(candidate.email))score+=80;
  if(source.phone&&normalize(source.phone)===normalize(candidate.phone))score+=70;
  if(sourceName&&sourceName===candidateName)score+=60;
  else if(sourceName&&candidateName&&(sourceName.includes(candidateName)||candidateName.includes(sourceName)))score+=25;
  if(source.city&&normalize(source.city)===normalize(candidate.city))score+=5;
  return score;
}

function sourceMoveCounts(sourceId){
  const projectIds=new Set(app.data.projects.filter(item=>item.client_id===sourceId).map(item=>item.id));
  return {
    projects:projectIds.size,
    documents:app.data.documents.filter(item=>item.client_id===sourceId).length,
    invoices:app.data.invoices.filter(item=>item.client_id===sourceId).length,
    emails:app.data.emailMessages.filter(item=>item.related_type==='client'&&item.related_id===sourceId).length
  };
}

function renderMerge(selectedTargetId=''){
  const source=clientById(currentClientId);
  if(!source||app.currentMembership?.role!=='owner')return app.notify('Solo el propietario puede unificar clientes.');
  const candidates=activeClients().filter(item=>item.id!==source.id).map(item=>({item,score:duplicateScore(source,item)})).sort((a,b)=>b.score-a.score||a.item.business_name.localeCompare(b.item.business_name));
  const targetId=selectedTargetId||candidates[0]?.item.id||'',target=clientById(targetId),counts=sourceMoveCounts(source.id);
  $('client360Eyebrow').textContent='UNIFICACIÓN ASISTIDA';
  $('client360Title').textContent='Consolidar clientes';
  $('client360Subtitle').textContent='El registro origen quedará inactivo y auditable.';
  $('client360Body').innerHTML='<div class="merge-toolbar"><button class="mini-btn" data-merge-back><i data-lucide="arrow-left"></i>Volver a la ficha</button></div><section class="merge-pair"><article><small>Registro origen</small><span class="client360-avatar">'+esc(initials(source.business_name))+'</span><b>'+esc(source.business_name)+'</b><p>'+esc(source.email||source.phone||source.city||'Sin datos adicionales')+'</p></article><i data-lucide="arrow-right"></i><article><small>Cliente definitivo</small><label><select id="mergeTargetSelect" aria-label="Cliente definitivo">'+candidates.map(({item,score})=>'<option value="'+item.id+'" '+(item.id===targetId?'selected':'')+'>'+esc(item.business_name)+(score?' · '+Math.min(100,score)+'% coincidencia':'')+'</option>').join('')+'</select></label><b>'+esc(target?.contact_name||'Seleccioná un cliente')+'</b><p>'+esc(target?.email||target?.phone||target?.city||'')+'</p></article></section>'+
    (candidates.length?'<section class="merge-impact"><div class="client-section-head"><div><span class="eyebrow">IMPACTO</span><h3>Registros que cambiarán de cliente</h3></div></div><div><span><i data-lucide="briefcase-business"></i><b>'+counts.projects+'</b><small>Proyectos</small></span><span><i data-lucide="files"></i><b>'+counts.documents+'</b><small>Documentos</small></span><span><i data-lucide="receipt-text"></i><b>'+counts.invoices+'</b><small>Comprobantes</small></span><span><i data-lucide="mail"></i><b>'+counts.emails+'</b><small>Correos</small></span></div></section><label class="merge-confirm"><input id="mergeConfirm" type="checkbox"><span><b>Confirmo el cliente definitivo</b><small>La operación conservará el historial y no eliminará el registro origen.</small></span></label><div class="conversion-actions"><button class="btn btn-secondary" data-merge-back>Cancelar</button><button class="btn btn-primary" id="mergeClientsBtn" data-merge-finish disabled><i data-lucide="combine"></i>Unificar clientes</button></div>':'<div class="empty-state"><i data-lucide="users-round"></i><div>No hay otro cliente activo para unificar.</div></div>');
  window.lucide?.createIcons();
}

async function mergeClients(button){
  const source=clientById(currentClientId),targetId=$('mergeTargetSelect')?.value;
  if(!source||!targetId||!$('mergeConfirm')?.checked)return;
  button.disabled=true;button.innerHTML='<span class="btn-spinner"></span>Unificando...';
  if(app.mode==='demo'){
    const target=clientById(targetId),now=new Date().toISOString();
    ['tax_identifier','contact_name','email','phone','address','city','notes','source_prospect_id','source_proposal_id'].forEach(key=>{if(!target[key]&&source[key])target[key]=source[key]});
    app.data.projects.forEach(item=>{if(item.client_id===source.id)item.client_id=target.id});
    app.data.documents.forEach(item=>{if(item.client_id===source.id)item.client_id=target.id});
    app.data.invoices.forEach(item=>{if(item.client_id===source.id)item.client_id=target.id});
    app.data.emailMessages.forEach(item=>{if(item.related_type==='client'&&item.related_id===source.id)item.related_id=target.id});
    Object.assign(source,{status:'inactive',merged_into_id:target.id,merged_at:now,merged_by:currentUserId(),updated_at:now});
    target.updated_at=now;app.saveDemo();renderClient360(target.id);app.notify('Clientes unificados');return;
  }
  const {error}=await app.supabase.rpc('merge_clients',{p_source_client_id:source.id,p_target_client_id:targetId});
  if(error){button.disabled=false;button.innerHTML='<i data-lucide="combine"></i>Unificar clientes';window.lucide?.createIcons();return app.notify('No se pudo unificar: '+error.message)}
  await app.reload();renderClient360(targetId);app.notify('Clientes unificados');
}

function openClientAction(type){
  const clientId=currentClientId;
  app.closeModal('client360Modal');app.openAction(type);
  const field=$('actionForm')?.elements?.client_id;
  if(field)field.value=clientId;
}

$('pipelineSavedViewSelect').addEventListener('change',event=>{
  selectedSavedViewId=event.target.value;
  $('pipelineDeleteViewBtn').disabled=!selectedSavedViewId;
  const view=savedViews().find(item=>item.id===selectedSavedViewId);
  if(view){applyingSavedView=true;app.applyPipelineFilters(view.filters||{});applyingSavedView=false}
});
$('pipelineSaveViewBtn').addEventListener('click',openSaveView);
$('pipelineDeleteViewBtn').addEventListener('click',openDeleteView);

['pipelineSearch','pipelineOwnerFilter','pipelineSectorFilter','pipelineFollowupFilter','pipelineProbabilityFilter','pipelineCurrencyFilter','pipelineOutcomeFilter','pipelineLimitFilter','pipelineHideEmpty'].forEach(id=>{
  const control=$(id),eventName=control.tagName==='INPUT'&&control.type==='search'?'input':'change';
  control.addEventListener(eventName,()=>{if(!applyingSavedView){selectedSavedViewId='';$('pipelineSavedViewSelect').value='';$('pipelineDeleteViewBtn').disabled=true}});
});

document.addEventListener('click',event=>{
  const open=event.target.closest('[data-client-open]');if(open){renderClient360(open.dataset.clientOpen);return}
  const deleteButton=event.target.closest('[data-confirm-view-delete]');if(deleteButton){deleteView(deleteButton.dataset.confirmViewDelete);return}
  if(event.target.closest('[data-client-merge]')){renderMerge();return}
  if(event.target.closest('[data-merge-back]')){renderClient360(currentClientId);return}
  const action=event.target.closest('[data-client-action]');if(action){openClientAction(action.dataset.clientAction);return}
  const finish=event.target.closest('[data-merge-finish]');if(finish)mergeClients(finish);
});

document.addEventListener('change',event=>{
  if(event.target.id==='mergeTargetSelect')renderMerge(event.target.value);
  if(event.target.id==='mergeConfirm')$('mergeClientsBtn').disabled=!event.target.checked;
});

window.addEventListener('sc:workspace',()=>{
  renderSavedViews();
  if(currentClientId&&!$('client360Modal').hidden&&clientById(currentClientId))renderClient360(currentClientId);
});

queueMicrotask(renderSavedViews);
