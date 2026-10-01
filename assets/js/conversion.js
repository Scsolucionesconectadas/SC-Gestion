import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.23/+esm';

const app=window.SC_APP;
const $=id=>document.getElementById(id);
const esc=value=>app.format.esc(value);
const uuid=()=>crypto.randomUUID?.()||(Date.now().toString(36)+Math.random().toString(36).slice(2));
const taskTemplates=[
  {id:'kickoff',title:'Coordinar reunión de inicio',description:'Alinear objetivos, responsables y próximos pasos.',priority:'alta',offset_days:1},
  {id:'discovery',title:'Completar relevamiento operativo',description:'Validar procesos, datos, usuarios e integraciones.',priority:'alta',offset_days:3},
  {id:'access',title:'Solicitar documentación y accesos',description:'Reunir la información necesaria para iniciar el proyecto.',priority:'media',offset_days:5}
];
let flow=null;

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\W+/g,' ').trim();
}
function proposal(id){return app.data.proposals.find(item=>item.id===id)}
function prospect(id){return app.data.prospects.find(item=>item.id===id)}
function client(id){return app.data.clients.find(item=>item.id===id)}
function duplicates(lead){
  const business=normalize(lead.business_name),email=normalize(lead.email),phone=String(lead.phone||'').replace(/\D/g,'');
  return app.data.clients.map(item=>{
    let score=0,reasons=[];
    if(business&&normalize(item.business_name)===business){score+=65;reasons.push('mismo nombre')}
    if(email&&normalize(item.email)===email){score+=30;reasons.push('mismo email')}
    if(phone&&String(item.phone||'').replace(/\D/g,'')===phone){score+=20;reasons.push('mismo teléfono')}
    return {item,score,reasons};
  }).filter(candidate=>candidate.score>=20).sort((a,b)=>b.score-a.score);
}
function progress(){
  return '<ol class="conversion-progress" aria-label="Progreso de la conversión">'+[
    ['1','Revisar'],['2','Configurar'],['3','Confirmar']
  ].map(([number,label],index)=>'<li class="'+(flow.step===index+1?'active':flow.step>index+1?'done':'')+'"><span>'+number+'</span><b>'+label+'</b></li>').join('')+'</ol>';
}
function summaryCard(){
  const quote=flow.quote,lead=flow.lead;
  return '<section class="conversion-summary"><div><span class="eyebrow">OPORTUNIDAD</span><h3>'+esc(lead.business_name)+'</h3><p>'+esc(lead.need_interest||quote.scope||'Sin alcance informado')+'</p></div><dl><div><dt>Propuesta</dt><dd>'+esc(quote.document_code||quote.title)+'</dd></div><div><dt>Importe</dt><dd>'+esc(app.format.money(quote.amount,quote.currency||'ARS'))+'</dd></div><div><dt>Responsable</dt><dd>'+esc(app.data.profiles.find(item=>item.id===lead.owner_id)?.full_name||'Sin asignar')+'</dd></div></dl></section>';
}
function renderReview(){
  const candidates=duplicates(flow.lead);
  if(flow.clientChoice===undefined)flow.clientChoice=candidates[0]?.score>=65?candidates[0].item.id:'new';
  const candidateMarkup=candidates.length?candidates.map(candidate=>'<label class="duplicate-option"><input type="radio" name="client_choice" value="'+candidate.item.id+'" '+(flow.clientChoice===candidate.item.id?'checked':'')+'><span><b>'+esc(candidate.item.business_name)+'</b><small>'+esc(candidate.reasons.join(' · '))+' · '+esc(candidate.item.email||candidate.item.phone||'Sin contacto')+'</small></span><em>'+candidate.score+'%</em></label>').join(''):'<div class="conversion-empty"><i data-lucide="badge-check"></i><span><b>No encontramos coincidencias</b><small>Se puede crear un cliente nuevo con los datos de la oportunidad.</small></span></div>';
  $('conversionBody').innerHTML=progress()+summaryCard()+'<section class="conversion-step"><div class="conversion-step-head"><span><i data-lucide="scan-search"></i></span><div><h3>Revisá posibles duplicados</h3><p>Vinculá un cliente existente cuando corresponda o creá una ficha nueva.</p></div></div><div class="duplicate-list">'+candidateMarkup+'<label class="duplicate-option create-new"><input type="radio" name="client_choice" value="new" '+(flow.clientChoice==='new'?'checked':'')+'><span><b>Crear un cliente nuevo</b><small>Conservará el vínculo con la oportunidad y la propuesta aceptada.</small></span><i data-lucide="user-round-plus"></i></label></div></section>'+actions(false,'Continuar','arrow-right');
}
function renderSetup(){
  const lead=flow.lead,existing=flow.clientChoice!=='new'?client(flow.clientChoice):null;
  const values=flow.clientData||{business_name:lead.business_name,tax_identifier:'',contact_name:lead.contact_name||'',email:lead.email||'',phone:lead.phone||'',city:lead.city||'',address:'',notes:''};
  const clientBlock=existing?'<div class="selected-client"><i data-lucide="building-2"></i><span><small>CLIENTE VINCULADO</small><b>'+esc(existing.business_name)+'</b><em>'+esc(existing.email||existing.phone||existing.city||'Ficha existente')+'</em></span></div>':'<div class="conversion-form-grid"><label>Razón comercial*<input name="business_name" value="'+esc(values.business_name)+'" required maxlength="160"></label><label>CUIT o identificación<input name="tax_identifier" value="'+esc(values.tax_identifier)+'" maxlength="40"></label><label>Persona de contacto<input name="contact_name" value="'+esc(values.contact_name)+'" maxlength="120"></label><label>Email<input name="email" type="email" value="'+esc(values.email)+'" maxlength="180"></label><label>Teléfono<input name="phone" value="'+esc(values.phone)+'" maxlength="40"></label><label>Localidad<input name="city" value="'+esc(values.city)+'" maxlength="100"></label><label class="full">Dirección<input name="address" value="'+esc(values.address)+'" maxlength="220"></label><label class="full">Notas<textarea name="notes" rows="2" maxlength="2000">'+esc(values.notes)+'</textarea></label></div>';
  const project=flow.projectData||{create_project:true,project_name:flow.quote.project_name||flow.quote.title,due_date:dayjs().add(Math.max(2,Number(flow.quote.delivery_weeks)||4),'week').format('YYYY-MM-DD'),tasks:taskTemplates.map(item=>item.id)};
  $('conversionBody').innerHTML=progress()+'<form id="conversionForm" class="conversion-step"><div class="conversion-step-head"><span><i data-lucide="contact-round"></i></span><div><h3>Definí el alta operativa</h3><p>Completá el cliente y decidí si el proyecto comienza ahora.</p></div></div>'+clientBlock+'<label class="conversion-switch"><input type="checkbox" name="create_project" '+(project.create_project?'checked':'')+'><span aria-hidden="true"></span><b>Crear proyecto a partir de la propuesta</b></label><div class="conversion-project" '+(project.create_project?'':'hidden')+'><div class="conversion-form-grid"><label>Nombre del proyecto*<input name="project_name" value="'+esc(project.project_name)+'" maxlength="180"></label><label>Fecha objetivo<input name="due_date" type="date" value="'+esc(project.due_date)+'"></label></div><fieldset class="conversion-tasks"><legend>Tareas iniciales</legend>'+taskTemplates.map(item=>'<label><input type="checkbox" name="initial_task" value="'+item.id+'" '+(project.tasks.includes(item.id)?'checked':'')+'><span><b>'+esc(item.title)+'</b><small>'+esc(item.description)+'</small></span></label>').join('')+'</fieldset></div>'+actions(true,'Revisar conversión','arrow-right')+'</form>';
  const toggle=$('conversionForm').elements.create_project,projectPanel=$('conversionBody').querySelector('.conversion-project');
  toggle.addEventListener('change',()=>{projectPanel.hidden=!toggle.checked});
}
function renderConfirmation(){
  const existing=flow.clientChoice!=='new'?client(flow.clientChoice):null,project=flow.projectData;
  const tasks=taskTemplates.filter(item=>project.tasks.includes(item.id));
  $('conversionBody').innerHTML=progress()+summaryCard()+'<section class="conversion-step confirmation-step"><div class="conversion-step-head"><span><i data-lucide="clipboard-check"></i></span><div><h3>Todo listo para convertir</h3><p>Esta acción mantiene los vínculos y registra la oportunidad como cliente.</p></div></div><dl class="conversion-review"><div><dt>Cliente</dt><dd>'+esc(existing?.business_name||flow.clientData.business_name)+'</dd></div><div><dt>Acción</dt><dd>'+(existing?'Vincular ficha existente':'Crear ficha nueva')+'</dd></div><div><dt>Proyecto</dt><dd>'+esc(project.create_project?project.project_name:'No crear por ahora')+'</dd></div><div><dt>Tareas iniciales</dt><dd>'+esc(project.create_project?(tasks.length+' seleccionadas'):'No aplica')+'</dd></div></dl><div class="conversion-notice"><i data-lucide="shield-check"></i><p>No se reemplazan datos existentes. La conversión queda asociada a la propuesta y no se puede duplicar.</p></div></section>'+actions(true,'Convertir oportunidad','badge-check',true);
}
function actions(back,label,icon,finish=false){
  return '<div class="conversion-actions">'+(back?'<button type="button" class="btn btn-secondary" data-conversion-back><i data-lucide="arrow-left"></i>Volver</button>':'<span></span>')+'<button type="button" class="btn btn-primary" '+(finish?'data-conversion-finish':'data-conversion-next')+'>'+esc(label)+'<i data-lucide="'+icon+'"></i></button></div>';
}
function render(){
  if(!flow)return;
  if(flow.step===1)renderReview();
  if(flow.step===2)renderSetup();
  if(flow.step===3)renderConfirmation();
  window.lucide?.createIcons();
}
function open(proposalId){
  const quote=proposal(proposalId),lead=quote?prospect(quote.prospect_id):null;
  if(!quote||!lead){app.notify('No se encontró la propuesta vinculada.');return}
  if(quote.status!=='aceptada'){app.notify('La propuesta debe estar aceptada antes de convertirla.');return}
  if(quote.converted_client_id){app.notify('Esta propuesta ya fue convertida.');return}
  flow={step:1,quote,lead};
  app.closeModal('detailModal');app.openModal('conversionModal');render();
}
function captureSetup(){
  const form=$('conversionForm');
  if(!form.reportValidity())return false;
  const values=new FormData(form),existing=flow.clientChoice!=='new';
  flow.clientData=existing?{}:{
    business_name:values.get('business_name').trim(),tax_identifier:values.get('tax_identifier').trim(),contact_name:values.get('contact_name').trim(),
    email:values.get('email').trim(),phone:values.get('phone').trim(),city:values.get('city').trim(),address:values.get('address').trim(),notes:values.get('notes').trim()
  };
  flow.projectData={create_project:values.get('create_project')==='on',project_name:values.get('project_name')?.trim()||'',due_date:values.get('due_date')||'',tasks:values.getAll('initial_task')};
  if(flow.projectData.create_project&&!flow.projectData.project_name){app.notify('Indicá el nombre del proyecto.');return false}
  return true;
}
function payload(){
  return {
    client_id:flow.clientChoice==='new'?null:flow.clientChoice,...flow.clientData,
    create_project:flow.projectData.create_project,project_name:flow.projectData.project_name,
    project_description:flow.quote.scope||flow.lead.need_interest||'',project_priority:'medium',
    owner_id:flow.lead.owner_id||app.currentProfile?.id,due_date:flow.projectData.due_date,
    tasks:flow.projectData.create_project?taskTemplates.filter(item=>flow.projectData.tasks.includes(item.id)):[]
  };
}
async function convertDemo(conversion){
  let clientId=conversion.client_id,projectId=null,now=new Date().toISOString();
  if(!clientId){
    clientId=uuid();
    app.data.clients.unshift({id:clientId,organization_id:app.activeOrganization?.id||'demo-sc',business_name:conversion.business_name,tax_identifier:conversion.tax_identifier||null,contact_name:conversion.contact_name||null,email:conversion.email||null,phone:conversion.phone||null,address:conversion.address||null,city:conversion.city||null,status:'active',notes:conversion.notes||null,source_prospect_id:flow.lead.id,source_proposal_id:flow.quote.id,created_by:app.currentProfile?.id,created_at:now,updated_at:now});
  }
  if(conversion.create_project){
    projectId=uuid();
    app.data.projects.unshift({id:projectId,organization_id:app.activeOrganization?.id||'demo-sc',client_id:clientId,prospect_id:flow.lead.id,name:conversion.project_name,description:conversion.project_description,status:'planned',priority:'medium',owner_id:conversion.owner_id,start_date:dayjs().format('YYYY-MM-DD'),due_date:conversion.due_date||null,budget:flow.quote.amount,currency:flow.quote.currency||'ARS',progress:0,created_by:app.currentProfile?.id,created_at:now,updated_at:now});
    conversion.tasks.forEach(item=>app.data.tasks.unshift({id:uuid(),organization_id:app.activeOrganization?.id||'demo-sc',prospect_id:flow.lead.id,project_id:projectId,assigned_to:conversion.owner_id,created_by:app.currentProfile?.id,title:item.title,description:item.description,priority:item.priority,status:'pendiente',due_at:dayjs().add(item.offset_days,'day').toISOString(),created_at:now}));
  }
  const previous=flow.lead.status;
  Object.assign(flow.quote,{converted_client_id:clientId,converted_project_id:projectId,converted_at:now,converted_by:app.currentProfile?.id});
  Object.assign(flow.lead,{status:'Cliente',probability:100,next_action:projectId?'Iniciar proyecto':'Completar alta del cliente',next_followup:dayjs().format('YYYY-MM-DD'),stage_entered_at:now,updated_at:now});
  app.data.prospectStageHistory.unshift({id:uuid(),organization_id:app.activeOrganization?.id||'demo-sc',prospect_id:flow.lead.id,from_status:previous,to_status:'Cliente',reason:null,changed_by:app.currentProfile?.id,changed_at:now});
  app.saveDemo();
}
async function finish(button){
  button.disabled=true;button.innerHTML='<span class="btn-spinner"></span>Convirtiendo...';
  try{
    const conversion=payload();
    if(app.mode==='supabase'){
      const {error}=await app.supabase.rpc('convert_accepted_proposal',{p_proposal_id:flow.quote.id,p_conversion:conversion});
      if(error)throw error;
      await app.reload();
    }else await convertDemo(conversion);
    app.closeModal('conversionModal');app.notify('Cliente y operación creados correctamente');flow=null;
  }catch(error){
    app.notify('No se pudo convertir: '+(error.message||error));button.disabled=false;button.innerHTML='Convertir oportunidad<i data-lucide="badge-check"></i>';window.lucide?.createIcons();
  }
}

document.addEventListener('click',async event=>{
  const trigger=event.target.closest('[data-convert]');if(trigger){open(trigger.dataset.convert);return}
  if(!flow||$('conversionModal').hidden)return;
  const back=event.target.closest('[data-conversion-back]');if(back){flow.step=Math.max(1,flow.step-1);render();return}
  const next=event.target.closest('[data-conversion-next]');if(next){
    if(flow.step===1){flow.clientChoice=$('conversionBody').querySelector('[name="client_choice"]:checked')?.value||'new';flow.step=2;render();return}
    if(flow.step===2&&captureSetup()){flow.step=3;render()}return;
  }
  const finishButton=event.target.closest('[data-conversion-finish]');if(finishButton)await finish(finishButton);
});
