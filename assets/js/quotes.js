import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/+esm';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.23/+esm';

const app=window.SC_APP;
const $=id=>document.getElementById(id);
const esc=value=>app.format.esc(value);
const STATUS_LABELS={
  borrador:'Borrador',revision:'En revisión',aprobada:'Aprobado',enviada:'Enviado',
  aceptada:'Aceptado',rechazada:'Rechazado',vencida:'Vencido'
};
const STATUS_CLASSES={borrador:'status-gray',revision:'status-amber',aprobada:'status-cyan',enviada:'status-blue',aceptada:'status-green',rechazada:'status-red',vencida:'status-red'};
const CATEGORIES=['Análisis / relevamiento','Implementación','Integración / API','Desarrollo','Configuración','Pruebas','Capacitación','Documentación','Soporte','Infraestructura','Licencias','Otro'];
const UNITS=['hora','unidad','etapa','mes','servicio','licencia'];
const TERMINAL_STATUSES=new Set(['aceptada','rechazada','vencida']);
let editor=null;

const uuid=()=>crypto.randomUUID?.()||(Date.now().toString(36)+Math.random().toString(36).slice(2));
const today=()=>dayjs().format('YYYY-MM-DD');
const number=value=>Number(value)||0;
const datePlusDays=days=>dayjs().add(days,'day').format('YYYY-MM-DD');
const proposal=id=>app.data.proposals.find(item=>item.id===id);
const prospect=id=>app.data.prospects.find(item=>item.id===id);
const money=(value,currency)=>app.format.money(number(value),currency||'ARS');
const icon=()=>window.lucide?.createIcons();

function proposalSections(proposalId){
  return app.data.proposalSections
    .filter(section=>section.proposal_id===proposalId)
    .sort((a,b)=>number(a.position)-number(b.position))
    .map(section=>({...section,items:app.data.proposalItems.filter(item=>item.section_id===section.id).sort((a,b)=>number(a.position)-number(b.position))}));
}

function statusPill(status){
  return '<span class="status-pill '+(STATUS_CLASSES[status]||'status-gray')+'">'+esc(STATUS_LABELS[status]||status)+'</span>';
}

function render(){
  const nav=document.querySelector('.nav [data-view="budgets"]');
  const allowed=app.mode==='demo'||app.hasPermission('quotes.view');
  if(nav)nav.hidden=!allowed;
  if(!allowed||!$('budgetRows'))return;
  const filter=$('budgetStatusFilter');
  const selected=filter.value;
  filter.innerHTML='<option value="">Todos los estados</option>'+Object.entries(STATUS_LABELS).map(([value,label])=>'<option value="'+value+'" '+(selected===value?'selected':'')+'>'+label+'</option>').join('');
  const rows=app.data.proposals.filter(item=>!selected||item.status===selected).sort((a,b)=>(b.updated_at||b.created_at||'').localeCompare(a.updated_at||a.created_at||''));
  const canWrite=app.mode==='demo'||app.hasPermission('quotes.write');
  $('budgetRows').innerHTML=rows.length?rows.map(item=>{
    const lead=prospect(item.prospect_id);
    return '<tr><td><span class="row-main"><b>'+esc(item.document_code||'Sin código')+'</b><small>'+app.format.fmtDate(item.issue_date||item.created_at)+'</small></span></td>'+
      '<td><span class="row-main"><b>'+esc(item.project_name||item.title)+'</b><small>'+esc(lead?.business_name||'Sin oportunidad')+'</small></span></td>'+
      '<td>v'+number(item.version||1)+'</td><td><b>'+money(item.amount,item.currency)+'</b></td><td>'+statusPill(item.status)+'</td><td>'+app.format.fmtDate(item.valid_until)+'</td>'+
      '<td><div class="row-actions">'+(canWrite&&!TERMINAL_STATUSES.has(item.status)?'<button class="mini-btn" data-quote-edit="'+item.id+'"><i data-lucide="pencil"></i>Editar</button>':'')+
      '<button class="mini-btn" data-quote-pdf="'+item.id+'"><i data-lucide="file-down"></i>PDF</button>'+
      (canWrite?'<button class="mini-btn" data-quote-version="'+item.id+'" title="Crear una nueva versión"><i data-lucide="copy-plus"></i>Versión</button>':'')+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="empty-state"><i data-lucide="file-spreadsheet"></i><div>Todavía no hay presupuestos.</div></div></td></tr>';
  $('mobileBudgets').innerHTML=rows.length?rows.map(item=>{
    const lead=prospect(item.prospect_id);
    return '<article class="mobile-card budget-mobile-card"><div class="mobile-card-top"><b>'+esc(item.document_code||'Presupuesto')+' · v'+number(item.version||1)+'</b>'+statusPill(item.status)+'</div><p>'+esc(item.project_name||item.title)+' · '+esc(lead?.business_name||'Sin oportunidad')+'</p><strong>'+money(item.amount,item.currency)+'</strong><div class="row-actions">'+(canWrite&&!TERMINAL_STATUSES.has(item.status)?'<button class="mini-btn" data-quote-edit="'+item.id+'">Editar</button>':'')+'<button class="mini-btn" data-quote-pdf="'+item.id+'">PDF</button>'+(canWrite?'<button class="mini-btn" data-quote-version="'+item.id+'">Nueva versión</button>':'')+'</div></article>';
  }).join(''):'<div class="empty-state"><i data-lucide="file-spreadsheet"></i><div>Todavía no hay presupuestos.</div></div>';
  renderKpis();
  icon();
}

function renderKpis(){
  const quotes=app.data.proposals;
  const sent=quotes.filter(item=>['enviada','aceptada'].includes(item.status));
  const accepted=quotes.filter(item=>item.status==='aceptada');
  const pending=quotes.filter(item=>item.status==='revision').length;
  const amountLabel=items=>{
    const grouped=items.reduce((result,item)=>({...result,[item.currency||'ARS']:(result[item.currency||'ARS']||0)+number(item.amount)}),{});
    return Object.entries(grouped).map(([currency,total])=>money(total,currency)).join(' · ')||money(0,'ARS');
  };
  $('budgetKpis').innerHTML=[
    ['Presupuestos',quotes.length,'file-spreadsheet','Total registrado'],
    ['Por aprobar',pending,'shield-check','En revisión interna'],
    ['Valor enviado',amountLabel(sent),'send','Enviados y aceptados'],
    ['Valor aceptado',amountLabel(accepted),'badge-check','Negocios confirmados']
  ].map(([label,value,iconName,caption])=>'<article class="kpi"><div class="kpi-top"><span class="kpi-label">'+label+'</span><span class="kpi-icon"><i data-lucide="'+iconName+'"></i></span></div><strong class="money-kpi">'+value+'</strong><small>'+caption+'</small></article>').join('');
}

function nextDocumentCode(){
  const year=dayjs().format('YYYY');
  const values=app.data.proposals.map(item=>{
    const match=String(item.document_code||'').match(new RegExp('^PRE-'+year+'-(\\d+)$'));
    return match?Number(match[1]):0;
  });
  return 'PRE-'+year+'-'+String(Math.max(0,...values)+1).padStart(4,'0');
}

function blankItem(){
  return {id:uuid(),category:CATEGORIES[0],description:'',quantity:1,unit:'hora',unit_cost:0,margin_percent:30,notes:''};
}

function blankSection(position=0){
  return {id:uuid(),title:'Etapa '+(position+1),description:'',position,items:[blankItem()]};
}

function createEditor(prospectId=null){
  const selected=prospectId||app.data.prospects.find(item=>!['Cliente','No interesado'].includes(item.status))?.id||'';
  const lead=prospect(selected);
  return {
    id:null,organization_id:app.activeOrganization?.id||'demo-sc',prospect_id:selected,
    document_code:nextDocumentCode(),version:1,title:lead?'Propuesta para '+lead.business_name:'Nueva propuesta comercial',
    project_name:lead?.need_interest||'',currency:'ARS',status:'borrador',issue_date:today(),valid_until:datePlusDays(15),
    delivery_weeks:4,tax_percent:0,discount_percent:0,payment_terms:'50% al inicio y 50% contra entrega',
    scope:lead?.need_interest||'',exclusions:'Servicios de terceros, licencias y equipamiento no indicados expresamente.',notes:'',change_reason:'',
    sections:[blankSection(0)],locked:false,persistedStatus:null
  };
}

function editFromProposal(item,{newVersion=false}={}){
  const sourceSections=proposalSections(item.id);
  const clone={
    ...item,id:newVersion?null:item.id,document_code:item.document_code||nextDocumentCode(),version:number(item.version||1)+(newVersion?1:0),
    status:newVersion?'borrador':item.status,issue_date:newVersion?today():(item.issue_date||today()),valid_until:newVersion?datePlusDays(15):item.valid_until,
    change_reason:newVersion?'Nueva versión a partir de v'+number(item.version||1):'',
    sections:(sourceSections.length?sourceSections:[blankSection(0)]).map((section,index)=>({...section,id:uuid(),position:index,items:(section.items.length?section.items:[blankItem()]).map((line,lineIndex)=>({...line,id:uuid(),position:lineIndex}))})),
    locked:!newVersion&&TERMINAL_STATUSES.has(item.status),persistedStatus:newVersion?null:item.status
  };
  return clone;
}

function statusOptions(){
  const current=editor.status;
  const persisted=editor.persistedStatus;
  let allowed=['borrador','revision'];
  if(editor.id&&['borrador','revision'].includes(persisted)&&app.hasPermission('quotes.approve'))allowed.push('aprobada');
  if(editor.id&&persisted==='aprobada')allowed=['aprobada','enviada'];
  if(editor.id&&persisted==='enviada')allowed=['enviada','aceptada','rechazada','vencida'];
  if(TERMINAL_STATUSES.has(persisted))allowed=[persisted];
  return [...new Set(allowed)].map(value=>'<option value="'+value+'" '+(current===value?'selected':'')+'>'+STATUS_LABELS[value]+'</option>').join('');
}

function prospectOptions(){
  return app.data.prospects.slice().sort((a,b)=>a.business_name.localeCompare(b.business_name)).map(item=>'<option value="'+item.id+'" '+(item.id===editor.prospect_id?'selected':'')+'>'+esc(item.business_name)+'</option>').join('');
}

function totals(){
  let cost=0,saleBeforeDiscount=0;
  editor.sections.forEach(section=>section.items.forEach(item=>{
    const lineCost=number(item.quantity)*number(item.unit_cost);
    cost+=lineCost;
    saleBeforeDiscount+=lineCost*(1+number(item.margin_percent)/100);
  }));
  const discount=saleBeforeDiscount*number(editor.discount_percent)/100;
  const subtotal=Math.max(0,saleBeforeDiscount-discount);
  const tax=subtotal*number(editor.tax_percent)/100;
  return {cost,saleBeforeDiscount,discount,subtotal,tax,total:subtotal+tax};
}

function qualityChecks(){
  const items=editor.sections.flatMap(section=>section.items);
  return [
    ['Oportunidad identificada',Boolean(prospect(editor.prospect_id))],
    ['Proyecto y alcance definidos',editor.title.trim().length>=3&&editor.scope.trim().length>=10],
    ['Exclusiones declaradas',editor.exclusions.trim().length>=10],
    ['Etapas con conceptos completos',editor.sections.length>0&&items.length>0&&items.every(item=>item.description.trim().length>=2&&number(item.quantity)>0)],
    ['Condiciones y vigencia',Boolean(editor.payment_terms.trim()&&editor.valid_until)],
    ['Importe calculado',totals().total>0]
  ];
}

function sectionMarkup(section,sectionIndex,disabled){
  return '<section class="quote-stage" data-stage="'+sectionIndex+'"><div class="quote-stage-head"><span class="quote-stage-number">'+String(sectionIndex+1).padStart(2,'0')+'</span><label><span>Nombre de la etapa</span><input data-section-field="title" value="'+esc(section.title)+'" maxlength="160" '+disabled+'></label><button type="button" class="icon-btn quote-remove" data-remove-section="'+sectionIndex+'" aria-label="Eliminar etapa" '+disabled+'><i data-lucide="trash-2"></i></button></div><label class="quote-stage-description"><span>Descripción y entregable</span><textarea data-section-field="description" rows="2" maxlength="1200" '+disabled+'>'+esc(section.description||'')+'</textarea></label><div class="quote-lines-head"><span>Conceptos</span><button type="button" class="btn btn-secondary" data-add-item="'+sectionIndex+'" '+disabled+'><i data-lucide="plus"></i>Agregar concepto</button></div><div class="quote-lines">'+section.items.map((item,itemIndex)=>itemMarkup(item,sectionIndex,itemIndex,disabled)).join('')+'</div><div class="quote-stage-total"><span>Total etapa</span><strong data-section-total="'+sectionIndex+'">'+money(section.items.reduce((sum,item)=>sum+number(item.quantity)*number(item.unit_cost)*(1+number(item.margin_percent)/100),0),editor.currency)+'</strong></div></section>';
}

function itemMarkup(item,sectionIndex,itemIndex,disabled){
  const lineSale=number(item.quantity)*number(item.unit_cost)*(1+number(item.margin_percent)/100);
  return '<div class="quote-line" data-item="'+itemIndex+'"><label class="quote-concept"><span>Categoría</span><select data-item-field="category" '+disabled+'>'+CATEGORIES.map(category=>'<option '+(category===item.category?'selected':'')+'>'+category+'</option>').join('')+'</select></label><label class="quote-description"><span>Descripción</span><input data-item-field="description" value="'+esc(item.description||'')+'" maxlength="500" placeholder="Ej.: relevamiento, integración o capacitación" '+disabled+'></label><label><span>Cantidad</span><input data-item-field="quantity" type="number" min="0.01" step="0.01" value="'+number(item.quantity||1)+'" '+disabled+'></label><label><span>Unidad</span><select data-item-field="unit" '+disabled+'>'+UNITS.map(unit=>'<option '+(unit===item.unit?'selected':'')+'>'+unit+'</option>').join('')+'</select></label><label><span>Costo unit.</span><input data-item-field="unit_cost" type="number" min="0" step="0.01" value="'+number(item.unit_cost)+'" '+disabled+'></label><label><span>Margen %</span><input data-item-field="margin_percent" type="number" min="0" max="1000" step="0.01" value="'+number(item.margin_percent)+'" '+disabled+'></label><div class="quote-line-total"><span>Venta</span><strong data-line-total>'+money(lineSale,editor.currency)+'</strong></div><button type="button" class="icon-btn quote-remove" data-remove-item="'+sectionIndex+':'+itemIndex+'" aria-label="Eliminar concepto" '+disabled+'><i data-lucide="x"></i></button></div>';
}

function renderEditor(){
  const disabled=editor.locked?'disabled':'';
  const checks=qualityChecks();
  $('budgetModalTitle').textContent=editor.id?'Editar presupuesto':'Nuevo presupuesto';
  $('budgetModalSubtitle').textContent=editor.locked?'Documento cerrado. Creá una nueva versión para modificarlo.':'Definí alcance, etapas y conceptos; el total se calcula automáticamente.';
  $('budgetBuilder').innerHTML='<form id="budgetForm" class="quote-builder"><div class="quote-stepbar" aria-label="Flujo del presupuesto"><span class="active"><i data-lucide="clipboard-list"></i>Datos</span><i></i><span class="active"><i data-lucide="layers-3"></i>Etapas</span><i></i><span><i data-lucide="shield-check"></i>Revisión</span><i></i><span><i data-lucide="send"></i>Emisión</span></div><div class="quote-builder-grid"><div class="quote-builder-main"><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">01 · IDENTIFICACIÓN</span><h3>Datos comerciales</h3></div>'+statusPill(editor.status)+'</div><div class="quote-form-grid"><label><span>Oportunidad</span><select data-header="prospect_id" required '+disabled+'>'+prospectOptions()+'</select></label><label><span>Código documental</span><input data-header="document_code" value="'+esc(editor.document_code)+'" maxlength="80" required '+disabled+'></label><label class="full"><span>Título de la propuesta</span><input data-header="title" value="'+esc(editor.title)+'" maxlength="180" required '+disabled+'></label><label class="full"><span>Nombre visible del proyecto</span><input data-header="project_name" value="'+esc(editor.project_name||'')+'" maxlength="180" '+disabled+'></label><label><span>Fecha de emisión</span><input data-header="issue_date" type="date" value="'+esc(editor.issue_date||today())+'" required '+disabled+'></label><label><span>Válida hasta</span><input data-header="valid_until" type="date" value="'+esc(editor.valid_until||'')+'" required '+disabled+'></label><label><span>Moneda</span><select data-header="currency" '+disabled+'><option '+(editor.currency==='ARS'?'selected':'')+'>ARS</option><option '+(editor.currency==='USD'?'selected':'')+'>USD</option></select></label><label><span>Plazo estimado (semanas)</span><input data-header="delivery_weeks" type="number" min="1" max="520" value="'+number(editor.delivery_weeks||4)+'" '+disabled+'></label></div></section><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">02 · ALCANCE</span><h3>Qué incluye y qué queda fuera</h3></div></div><div class="quote-form-grid"><label><span>Alcance incluido</span><textarea data-header="scope" rows="5" maxlength="4000" '+disabled+'>'+esc(editor.scope||'')+'</textarea></label><label><span>Exclusiones y supuestos</span><textarea data-header="exclusions" rows="5" maxlength="4000" '+disabled+'>'+esc(editor.exclusions||'')+'</textarea></label></div></section><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">03 · COSTEO</span><h3>Etapas y conceptos</h3></div><button type="button" class="btn btn-secondary" id="addQuoteSection" '+disabled+'><i data-lucide="plus"></i>Nueva etapa</button></div><div class="quote-stages" id="quoteStages">'+editor.sections.map((section,index)=>sectionMarkup(section,index,disabled)).join('')+'</div></section><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">04 · CONDICIONES</span><h3>Pago, impuestos y notas</h3></div></div><div class="quote-form-grid"><label class="full"><span>Forma de pago</span><input data-header="payment_terms" value="'+esc(editor.payment_terms||'')+'" maxlength="500" '+disabled+'></label><label><span>Descuento general %</span><input data-header="discount_percent" type="number" min="0" max="100" step="0.01" value="'+number(editor.discount_percent)+'" '+disabled+'></label><label><span>Impuestos %</span><input data-header="tax_percent" type="number" min="0" max="100" step="0.01" value="'+number(editor.tax_percent)+'" '+disabled+'></label><label class="full"><span>Notas comerciales</span><textarea data-header="notes" rows="3" maxlength="2000" '+disabled+'>'+esc(editor.notes||'')+'</textarea></label><label><span>Estado</span><select data-header="status" '+disabled+'>'+statusOptions()+'</select></label><label><span>Motivo de la versión</span><input data-header="change_reason" value="'+esc(editor.change_reason||'')+'" maxlength="500" '+disabled+'></label></div></section></div><aside class="quote-summary"><div class="quote-summary-card"><span class="eyebrow">RESUMEN ECONÓMICO</span><div class="quote-summary-client"><small>Oportunidad</small><strong id="quoteProspectName">'+esc(prospect(editor.prospect_id)?.business_name||'Sin seleccionar')+'</strong></div><dl><div><dt>Costo interno</dt><dd id="quoteCost">-</dd></div><div><dt>Venta antes de descuento</dt><dd id="quoteSale">-</dd></div><div><dt>Descuento</dt><dd id="quoteDiscount">-</dd></div><div><dt>Subtotal</dt><dd id="quoteSubtotal">-</dd></div><div><dt>Impuestos</dt><dd id="quoteTax">-</dd></div><div class="quote-total"><dt>Total final</dt><dd id="quoteTotal">-</dd></div></dl></div><div class="quote-quality"><span class="eyebrow">CONTROL PREVIO</span><div id="quoteQuality">'+checks.map(([label,ok])=>'<div class="'+(ok?'ok':'pending')+'"><i data-lucide="'+(ok?'check-circle-2':'circle-dashed')+'"></i><span>'+label+'</span></div>').join('')+'</div></div></aside></div><div class="quote-form-actions"><div><span class="quote-version-chip">'+esc(editor.document_code)+' · v'+number(editor.version||1)+'</span></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="budgetModal">Cerrar</button>'+(!editor.locked?'<button type="submit" class="btn btn-primary"><i data-lucide="save"></i>Guardar presupuesto</button>':'')+'</div></div></form>';
  bindEditor();
  updateCalculations();
  icon();
}

function bindEditor(){
  const form=$('budgetForm');
  if(!form)return;
  form.addEventListener('submit',saveProposal);
  form.addEventListener('input',handleEditorInput);
  form.addEventListener('change',handleEditorInput);
  form.addEventListener('click',event=>{
    const addItem=event.target.closest('[data-add-item]');
    if(addItem){editor.sections[number(addItem.dataset.addItem)].items.push(blankItem());renderEditor();return}
    const removeItem=event.target.closest('[data-remove-item]');
    if(removeItem){const [sectionIndex,itemIndex]=removeItem.dataset.removeItem.split(':').map(Number);editor.sections[sectionIndex].items.splice(itemIndex,1);if(!editor.sections[sectionIndex].items.length)editor.sections[sectionIndex].items.push(blankItem());renderEditor();return}
    const removeSection=event.target.closest('[data-remove-section]');
    if(removeSection){if(editor.sections.length===1){app.notify('El presupuesto necesita al menos una etapa.');return}editor.sections.splice(number(removeSection.dataset.removeSection),1);editor.sections.forEach((section,index)=>section.position=index);renderEditor();return}
    if(event.target.closest('#addQuoteSection')){editor.sections.push(blankSection(editor.sections.length));renderEditor()}
  });
}

function handleEditorInput(event){
  const header=event.target.dataset.header;
  if(header){editor[header]=event.target.type==='number'?number(event.target.value):event.target.value;if(header==='prospect_id')$('quoteProspectName').textContent=prospect(editor.prospect_id)?.business_name||'Sin seleccionar';if(['currency','status'].includes(header)){renderEditor();return}updateCalculations();return}
  const stage=event.target.closest('[data-stage]');
  if(!stage)return;
  const section=editor.sections[number(stage.dataset.stage)];
  if(event.target.dataset.sectionField){section[event.target.dataset.sectionField]=event.target.value;return}
  const line=event.target.closest('[data-item]');
  if(!line)return;
  const item=section.items[number(line.dataset.item)],field=event.target.dataset.itemField;
  if(field)item[field]=event.target.type==='number'?number(event.target.value):event.target.value;
  updateCalculations();
}

function updateCalculations(){
  if(!$('quoteTotal'))return;
  const summary=totals();
  $('quoteCost').textContent=money(summary.cost,editor.currency);
  $('quoteSale').textContent=money(summary.saleBeforeDiscount,editor.currency);
  $('quoteDiscount').textContent='- '+money(summary.discount,editor.currency);
  $('quoteSubtotal').textContent=money(summary.subtotal,editor.currency);
  $('quoteTax').textContent=money(summary.tax,editor.currency);
  $('quoteTotal').textContent=money(summary.total,editor.currency);
  document.querySelectorAll('.quote-stage').forEach(stage=>{
    const sectionIndex=number(stage.dataset.stage),section=editor.sections[sectionIndex];
    stage.querySelectorAll('.quote-line').forEach(line=>{
      const item=section.items[number(line.dataset.item)];
      line.querySelector('[data-line-total]').textContent=money(number(item.quantity)*number(item.unit_cost)*(1+number(item.margin_percent)/100),editor.currency);
    });
    const stageTotal=section.items.reduce((sum,item)=>sum+number(item.quantity)*number(item.unit_cost)*(1+number(item.margin_percent)/100),0);
    stage.querySelector('[data-section-total]').textContent=money(stageTotal,editor.currency);
  });
  const quality=$('quoteQuality');
  if(quality){quality.innerHTML=qualityChecks().map(([label,ok])=>'<div class="'+(ok?'ok':'pending')+'"><i data-lucide="'+(ok?'check-circle-2':'circle-dashed')+'"></i><span>'+label+'</span></div>').join('');icon()}
}

function openBuilder(id=null,prospectId=null,{newVersion=false}={}){
  if(!(app.mode==='demo'||app.hasPermission('quotes.write'))&&!id){app.notify('Tu rol no puede crear presupuestos.');return}
  const item=id?proposal(id):null;
  editor=item?editFromProposal(item,{newVersion}):createEditor(prospectId);
  app.setView('budgets');
  renderEditor();
  app.openModal('budgetModal');
}

function validationMessage(){
  if(!prospect(editor.prospect_id))return 'Seleccioná una oportunidad.';
  if(editor.title.trim().length<3)return 'Ingresá un título para la propuesta.';
  if(!editor.document_code.trim())return 'Ingresá el código documental.';
  if(!editor.sections.length)return 'Agregá al menos una etapa.';
  for(const section of editor.sections){
    if(section.title.trim().length<2)return 'Cada etapa necesita un nombre.';
    if(!section.items.length)return 'Cada etapa necesita al menos un concepto.';
    for(const item of section.items){
      if(item.description.trim().length<2)return 'Completá la descripción de todos los conceptos.';
      if(number(item.quantity)<=0)return 'La cantidad de cada concepto debe ser mayor que cero.';
    }
  }
  if(editor.status!=='borrador'){
    const pending=qualityChecks().filter(([,ok])=>!ok);
    if(pending.length)return 'Completá el control previo antes de cambiar el estado.';
  }
  return '';
}

function proposalPayload(){
  return {
    id:editor.id||'',organization_id:editor.organization_id,prospect_id:editor.prospect_id,
    document_code:editor.document_code.trim(),version:number(editor.version||1),title:editor.title.trim(),project_name:editor.project_name.trim(),
    currency:editor.currency,status:editor.status,issue_date:editor.issue_date,valid_until:editor.valid_until,
    delivery_weeks:String(number(editor.delivery_weeks||0)||''),tax_percent:number(editor.tax_percent),discount_percent:number(editor.discount_percent),
    scope:editor.scope.trim(),exclusions:editor.exclusions.trim(),payment_terms:editor.payment_terms.trim(),notes:editor.notes.trim(),change_reason:editor.change_reason.trim()
  };
}

function sectionsPayload(){
  return editor.sections.map((section,index)=>({
    title:section.title.trim(),description:section.description.trim(),position:index,
    items:section.items.map((item,itemIndex)=>({category:item.category,description:item.description.trim(),quantity:number(item.quantity),unit:item.unit,unit_cost:number(item.unit_cost),margin_percent:number(item.margin_percent),notes:item.notes||'',position:itemIndex}))
  }));
}

async function saveProposal(event){
  event.preventDefault();
  const error=validationMessage();
  if(error){app.notify(error);return}
  const button=event.submitter||event.target.querySelector('[type="submit"]');
  if(button){button.disabled=true;button.textContent='Guardando...'}
  try{
    if(app.mode==='supabase'){
      const {error:saveError}=await app.supabase.rpc('save_commercial_proposal',{p_proposal:proposalPayload(),p_sections:sectionsPayload()});
      if(saveError)throw saveError;
      await app.reload();
    }else{
      saveDemoProposal();
    }
    app.closeModal('budgetModal');
    app.notify('Presupuesto guardado');
  }catch(saveError){
    app.notify('No se pudo guardar: '+(saveError.message||saveError));
  }finally{
    if(button)button.disabled=false;
  }
}

function saveDemoProposal(){
  const total=totals(),id=editor.id||uuid(),now=new Date().toISOString();
  const header={...proposalPayload(),id,organization_id:app.activeOrganization?.id||'demo-sc',created_by:app.currentUser?.id,amount:total.total,subtotal_cost:total.cost,subtotal_sale:total.subtotal,tax_amount:total.tax,created_at:proposal(id)?.created_at||now,updated_at:now};
  const existing=app.data.proposals.findIndex(item=>item.id===id);
  if(existing>=0)app.data.proposals[existing]=header;else app.data.proposals.unshift(header);
  app.data.proposalItems=app.data.proposalItems.filter(item=>item.proposal_id!==id);
  app.data.proposalSections=app.data.proposalSections.filter(section=>section.proposal_id!==id);
  editor.sections.forEach((section,sectionIndex)=>{
    const sectionId=uuid();
    app.data.proposalSections.push({id:sectionId,organization_id:header.organization_id,proposal_id:id,title:section.title,description:section.description,position:sectionIndex});
    section.items.forEach((item,itemIndex)=>{
      const lineCost=number(item.quantity)*number(item.unit_cost),unitPrice=number(item.unit_cost)*(1+number(item.margin_percent)/100);
      app.data.proposalItems.push({...item,id:uuid(),organization_id:header.organization_id,proposal_id:id,section_id:sectionId,position:itemIndex,unit_price:unitPrice,subtotal_cost:lineCost,subtotal_sale:lineCost*(1+number(item.margin_percent)/100)});
    });
  });
  const versionIndex=app.data.proposalVersions.findIndex(item=>item.proposal_id===id&&number(item.version)===number(header.version));
  const version={id:versionIndex>=0?app.data.proposalVersions[versionIndex].id:uuid(),organization_id:header.organization_id,proposal_id:id,version:header.version,snapshot:{proposal:header,sections:sectionsPayload()},change_reason:header.change_reason,created_by:app.currentUser?.id,created_at:now};
  if(versionIndex>=0)app.data.proposalVersions[versionIndex]=version;else app.data.proposalVersions.unshift(version);
  const lead=prospect(header.prospect_id);
  if(header.status==='enviada'&&lead){lead.status='Propuesta enviada';lead.next_action='Esperar respuesta'}
  if(header.status==='aceptada'&&lead){lead.status='Negociación';lead.next_action='Convertir en cliente'}
  app.saveDemo();
}

async function imageAsPng(path){
  return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);resolve({data:canvas.toDataURL('image/png'),ratio:image.naturalWidth/image.naturalHeight})};image.onerror=reject;image.src=path});
}

function pdfText(doc,text,x,y,maxWidth,lineHeight=4){
  const lines=doc.splitTextToSize(String(text||''),maxWidth);doc.text(lines,x,y);return y+lines.length*lineHeight;
}

async function generatePdf(id){
  const item=proposal(id);if(!item)return;
  const lead=prospect(item.prospect_id)||{},sections=proposalSections(id),org=app.activeOrganization||{};
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  const addHeader=async()=>{
    try{const logo=await imageAsPng('./assets/img/sc-isotipo-color.webp');const width=28,height=Math.min(13,width/logo.ratio);doc.addImage(logo.data,'PNG',16,12,width,height)}catch{}
    doc.setTextColor(31,47,60);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text(org.name||'Soluciones Conectadas',194,17,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(94,115,130);doc.text('PROPUESTA COMERCIAL Y TÉCNICA',194,23,{align:'right'});doc.setDrawColor(211,224,233);doc.line(16,31,194,31);
  };
  await addHeader();
  let y=43;
  doc.setFont('helvetica','bold');doc.setFontSize(19);doc.setTextColor(31,47,60);y=pdfText(doc,item.title,16,y,116,7);
  doc.setFontSize(9);doc.text((item.document_code||'PRE')+' · v'+number(item.version||1),16,y+2);
  doc.setFont('helvetica','normal');doc.setTextColor(94,115,130);doc.text('Emisión',145,42);doc.text(app.format.fmtDate(item.issue_date||item.created_at),194,42,{align:'right'});doc.text('Validez',145,49);doc.text(app.format.fmtDate(item.valid_until),194,49,{align:'right'});doc.text('Moneda',145,56);doc.text(item.currency||'ARS',194,56,{align:'right'});
  y=Math.max(y+12,68);doc.setFillColor(245,249,252);doc.roundedRect(16,y-7,178,27,2,2,'F');doc.setFontSize(7);doc.setTextColor(94,115,130);doc.text('CLIENTE / OPORTUNIDAD',22,y);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(31,47,60);doc.text(lead.business_name||'Sin identificar',22,y+8);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text([lead.contact_name,lead.email,lead.phone].filter(Boolean).join(' · ')||'Datos de contacto no informados',22,y+15);
  y+=32;
  const textBlock=(title,text)=>{doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(3,96,189);doc.text(title,16,y);y+=6;doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(31,47,60);y=pdfText(doc,text||'No especificado.',16,y,178,4);y+=7};
  textBlock('ALCANCE INCLUIDO',item.scope);
  textBlock('EXCLUSIONES Y SUPUESTOS',item.exclusions);
  for(const section of sections){
    if(y>235){doc.addPage();await addHeader();y=42}
    doc.setFillColor(43,58,70);doc.rect(16,y-5,178,9,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(section.title,20,y+1);y+=11;
    if(section.description){doc.setTextColor(94,115,130);doc.setFont('helvetica','normal');doc.setFontSize(7);y=pdfText(doc,section.description,20,y,168,3.5);y+=3}
    doc.setTextColor(94,115,130);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('CONCEPTO',20,y);doc.text('CANT.',132,y,{align:'right'});doc.text('P. UNIT.',160,y,{align:'right'});doc.text('SUBTOTAL',190,y,{align:'right'});y+=5;
    let sectionTotal=0;
    for(const line of section.items){
      if(y>264){doc.addPage();await addHeader();y=42}
      const subtotal=number(line.subtotal_sale)||number(line.quantity)*number(line.unit_cost)*(1+number(line.margin_percent)/100);sectionTotal+=subtotal;
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(31,47,60);doc.text(String(line.description).slice(0,74),20,y);doc.text(number(line.quantity)+' '+line.unit,132,y,{align:'right'});doc.text(money(line.unit_price||number(line.unit_cost)*(1+number(line.margin_percent)/100),item.currency),160,y,{align:'right'});doc.text(money(subtotal,item.currency),190,y,{align:'right'});doc.setDrawColor(232,238,242);doc.line(20,y+3,190,y+3);y+=8;
    }
    doc.setFont('helvetica','bold');doc.text('Total etapa',160,y,{align:'right'});doc.text(money(sectionTotal,item.currency),190,y,{align:'right'});y+=10;
  }
  if(y>225){doc.addPage();await addHeader();y=42}
  doc.setDrawColor(211,224,233);doc.line(112,y,194,y);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(94,115,130);doc.text('Subtotal',160,y+8,{align:'right'});doc.text('Impuestos '+number(item.tax_percent)+'%',160,y+16,{align:'right'});doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(31,47,60);doc.text('TOTAL',160,y+28,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(money(item.subtotal_sale,item.currency),194,y+8,{align:'right'});doc.text(money(item.tax_amount,item.currency),194,y+16,{align:'right'});doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(money(item.amount,item.currency),194,y+28,{align:'right'});
  y+=42;doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('CONDICIONES COMERCIALES',16,y);doc.setFont('helvetica','normal');doc.setTextColor(94,115,130);y=pdfText(doc,'Forma de pago: '+(item.payment_terms||'A convenir')+' · Plazo estimado: '+(item.delivery_weeks||'-')+' semanas.',16,y+6,178,4);
  if(!['enviada','aceptada'].includes(item.status)){doc.setFont('helvetica','bold');doc.setFontSize(38);doc.setTextColor(229,234,238);doc.text('BORRADOR',105,155,{align:'center',angle:35})}
  const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(110,128,141);doc.text('Generado por SC Gestión · Presupuesto comercial · Página '+page+' de '+pages,105,287,{align:'center'})}
  doc.save((item.document_code||'presupuesto')+'-v'+number(item.version||1)+'.pdf');
  app.notify('PDF generado');
}

function bind(){
  $('newBudgetBtn')?.addEventListener('click',()=>openBuilder());
  $('budgetStatusFilter')?.addEventListener('change',render);
  document.addEventListener('click',event=>{
    const edit=event.target.closest('[data-quote-edit]');if(edit){openBuilder(edit.dataset.quoteEdit);return}
    const pdf=event.target.closest('[data-quote-pdf]');if(pdf){generatePdf(pdf.dataset.quotePdf);return}
    const version=event.target.closest('[data-quote-version]');if(version){openBuilder(version.dataset.quoteVersion,null,{newVersion:true});return}
  });
  window.addEventListener('sc:workspace',render);
  window.addEventListener('sc:quote:new',event=>openBuilder(null,event.detail?.prospectId||null));
}

bind();
render();
