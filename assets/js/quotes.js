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
const PROPOSAL_TYPES={detailed:'Presupuesto detallado',conceptual:'Propuesta conceptual'};
const PRICING_DISPLAYS={itemized:'Conceptos y precios',section_total:'Total por módulo',total_only:'Solo inversión total'};
const CATEGORIES=['Análisis / relevamiento','Implementación','Integración / API','Desarrollo','Configuración','Pruebas','Capacitación','Documentación','Soporte','Infraestructura','Licencias','Otro'];
const UNITS=['hora','unidad','concepto','etapa','mes','servicio','licencia'];
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
const proposalType=item=>PROPOSAL_TYPES[item?.proposal_type]||PROPOSAL_TYPES.detailed;
function quoteConfiguration(){
  const settings=app.activeOrganization?.settings?.quotes||{};
  const documentPrefix=/^[A-Z0-9-]{2,10}$/.test(String(settings.document_prefix||'').toUpperCase())?String(settings.document_prefix).toUpperCase():'PRE';
  return {
    documentPrefix,
    validityDays:Math.max(1,Math.min(365,number(settings.validity_days)||15)),
    taxPercent:Math.max(0,Math.min(100,number(settings.tax_percent))),
    marginPercent:Math.max(0,Math.min(1000,number(settings.margin_percent)||30)),
    deliveryWeeks:Math.max(1,Math.min(520,number(settings.delivery_weeks)||4)),
    paymentTerms:String(settings.payment_terms||'50% al inicio y 50% contra entrega')
  };
}

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
    return '<tr><td><span class="row-main"><b>'+esc(item.document_code||'Sin código')+'</b><small>'+esc(proposalType(item))+' · '+app.format.fmtDate(item.issue_date||item.created_at)+'</small></span></td>'+
      '<td><span class="row-main"><b>'+esc(item.project_name||item.title)+'</b><small>'+esc(lead?.business_name||'Sin oportunidad')+'</small></span></td>'+
      '<td>v'+number(item.version||1)+'</td><td><b>'+money(item.amount,item.currency)+'</b></td><td>'+statusPill(item.status)+'</td><td>'+app.format.fmtDate(item.valid_until)+'</td>'+
      '<td><div class="row-actions">'+(canWrite&&!TERMINAL_STATUSES.has(item.status)?'<button class="mini-btn" data-quote-edit="'+item.id+'"><i data-lucide="pencil"></i>Editar</button>':'')+
      '<button class="mini-btn" data-quote-pdf="'+item.id+'"><i data-lucide="file-down"></i>PDF</button>'+
      (canWrite?'<button class="mini-btn" data-quote-version="'+item.id+'" title="Crear una nueva versión"><i data-lucide="copy-plus"></i>Versión</button>':'')+'</div></td></tr>';
  }).join(''):'<tr><td colspan="7"><div class="empty-state"><i data-lucide="file-spreadsheet"></i><div>Todavía no hay presupuestos.</div></div></td></tr>';
  $('mobileBudgets').innerHTML=rows.length?rows.map(item=>{
    const lead=prospect(item.prospect_id);
    return '<article class="mobile-card budget-mobile-card"><div class="mobile-card-top"><b>'+esc(item.document_code||'Presupuesto')+' · v'+number(item.version||1)+'</b>'+statusPill(item.status)+'</div><p>'+esc(proposalType(item))+' · '+esc(item.project_name||item.title)+' · '+esc(lead?.business_name||'Sin oportunidad')+'</p><strong>'+money(item.amount,item.currency)+'</strong><div class="row-actions">'+(canWrite&&!TERMINAL_STATUSES.has(item.status)?'<button class="mini-btn" data-quote-edit="'+item.id+'">Editar</button>':'')+'<button class="mini-btn" data-quote-pdf="'+item.id+'">PDF</button>'+(canWrite?'<button class="mini-btn" data-quote-version="'+item.id+'">Nueva versión</button>':'')+'</div></article>';
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
  const year=dayjs().format('YYYY'),prefix=quoteConfiguration().documentPrefix;
  const escapedPrefix=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const values=app.data.proposals.map(item=>{
    const match=String(item.document_code||'').match(new RegExp('^'+escapedPrefix+'-'+year+'-(\\d+)$'));
    return match?Number(match[1]):0;
  });
  return prefix+'-'+year+'-'+String(Math.max(0,...values)+1).padStart(4,'0');
}

function blankItem(){
  return {id:uuid(),category:CATEGORIES[0],description:'',quantity:1,unit:'hora',unit_cost:0,margin_percent:quoteConfiguration().marginPercent,notes:''};
}

function blankSection(position=0){
  return {id:uuid(),title:'Etapa '+(position+1),description:'',position,items:[blankItem()]};
}

function createEditor(prospectId=null){
  const configuration=quoteConfiguration();
  const selected=prospectId||app.data.prospects.find(item=>!['Cliente','No interesado'].includes(item.status))?.id||'';
  const lead=prospect(selected);
  return {
    id:null,organization_id:app.activeOrganization?.id||'demo-sc',prospect_id:selected,
    document_code:nextDocumentCode(),version:1,title:lead?'Propuesta para '+lead.business_name:'Nueva propuesta comercial',
    proposal_type:'detailed',pricing_display:'itemized',cover_enabled:false,cover_subtitle:lead?.need_interest||'',
    executive_summary:'',objective:lead?.need_interest||'',project_name:lead?.need_interest||'',currency:app.activeOrganization?.default_currency||'ARS',status:'borrador',issue_date:today(),valid_until:datePlusDays(configuration.validityDays),
    delivery_weeks:configuration.deliveryWeeks,tax_percent:configuration.taxPercent,discount_percent:0,payment_terms:configuration.paymentTerms,
    scope:lead?.need_interest||'',exclusions:'Servicios de terceros, licencias y equipamiento no indicados expresamente.',notes:'',change_reason:'',
    sections:[blankSection(0)],locked:false,persistedStatus:null
  };
}

function editFromProposal(item,{newVersion=false}={}){
  const sourceSections=proposalSections(item.id);
  const configuration=quoteConfiguration();
  const clone={
    ...item,id:newVersion?null:item.id,document_code:item.document_code||nextDocumentCode(),version:number(item.version||1)+(newVersion?1:0),
    proposal_type:item.proposal_type||'detailed',pricing_display:item.pricing_display||'itemized',cover_enabled:item.cover_enabled===true,
    cover_subtitle:item.cover_subtitle||'',executive_summary:item.executive_summary||'',objective:item.objective||'',
    status:newVersion?'borrador':item.status,issue_date:newVersion?today():(item.issue_date||today()),valid_until:newVersion?datePlusDays(configuration.validityDays):item.valid_until,
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
  const checks=[
    ['Oportunidad identificada',Boolean(prospect(editor.prospect_id))],
    ['Proyecto y alcance definidos',editor.title.trim().length>=3&&editor.scope.trim().length>=10],
    ['Exclusiones declaradas',editor.exclusions.trim().length>=10],
    ['Etapas con conceptos completos',editor.sections.length>0&&items.length>0&&items.every(item=>item.description.trim().length>=2&&number(item.quantity)>0)],
    ['Condiciones y vigencia',Boolean(editor.payment_terms.trim()&&editor.valid_until)],
    ['Importe calculado',totals().total>0]
  ];
  if(editor.proposal_type==='conceptual')checks.splice(2,0,
    ['Resumen ejecutivo completo',editor.executive_summary.trim().length>=30],
    ['Objetivo declarado',editor.objective.trim().length>=10]
  );
  return checks;
}

function sectionMarkup(section,sectionIndex,disabled){
  const conceptual=editor.proposal_type==='conceptual';
  return '<section class="quote-stage '+(conceptual?'is-conceptual':'')+'" data-stage="'+sectionIndex+'"><div class="quote-stage-head"><span class="quote-stage-number">'+String(sectionIndex+1).padStart(2,'0')+'</span><label><span>'+(conceptual?'Nombre del módulo o solución':'Nombre de la etapa')+'</span><input data-section-field="title" value="'+esc(section.title)+'" maxlength="160" '+disabled+'></label><button type="button" class="icon-btn quote-remove" data-remove-section="'+sectionIndex+'" aria-label="Eliminar '+(conceptual?'módulo':'etapa')+'" '+disabled+'><i data-lucide="trash-2"></i></button></div><label class="quote-stage-description"><span>'+(conceptual?'Descripción conceptual y resultado esperado':'Descripción y entregable')+'</span><textarea data-section-field="description" rows="3" maxlength="1200" '+disabled+'>'+esc(section.description||'')+'</textarea></label><div class="quote-lines-head"><span>'+(conceptual?'Conceptos incluidos':'Conceptos')+'</span><button type="button" class="btn btn-secondary" data-add-item="'+sectionIndex+'" '+disabled+'><i data-lucide="plus"></i>Agregar concepto</button></div><div class="quote-lines">'+section.items.map((item,itemIndex)=>itemMarkup(item,sectionIndex,itemIndex,disabled)).join('')+'</div><div class="quote-stage-total"><span>'+(conceptual?'Inversión del módulo':'Total etapa')+'</span><strong data-section-total="'+sectionIndex+'">'+money(section.items.reduce((sum,item)=>sum+number(item.quantity)*number(item.unit_cost)*(1+number(item.margin_percent)/100),0),editor.currency)+'</strong></div></section>';
}

function itemMarkup(item,sectionIndex,itemIndex,disabled){
  const lineSale=number(item.quantity)*number(item.unit_cost)*(1+number(item.margin_percent)/100);
  return '<div class="quote-line" data-item="'+itemIndex+'"><label class="quote-concept"><span>Categoría</span><select data-item-field="category" '+disabled+'>'+CATEGORIES.map(category=>'<option '+(category===item.category?'selected':'')+'>'+category+'</option>').join('')+'</select></label><label class="quote-description"><span>'+(editor.proposal_type==='conceptual'?'Concepto o solución':'Descripción')+'</span><input data-item-field="description" value="'+esc(item.description||'')+'" maxlength="500" placeholder="Ej.: relevamiento, integración o capacitación" '+disabled+'></label><label><span>Cantidad</span><input data-item-field="quantity" type="number" min="0.01" step="0.01" value="'+number(item.quantity||1)+'" '+disabled+'></label><label><span>Unidad</span><select data-item-field="unit" '+disabled+'>'+UNITS.map(unit=>'<option '+(unit===item.unit?'selected':'')+'>'+unit+'</option>').join('')+'</select></label><label><span>Costo unit.</span><input data-item-field="unit_cost" type="number" min="0" step="0.01" value="'+number(item.unit_cost)+'" '+disabled+'></label><label><span>Margen %</span><input data-item-field="margin_percent" type="number" min="0" max="1000" step="0.01" value="'+number(item.margin_percent)+'" '+disabled+'></label><div class="quote-line-total"><span>Venta</span><strong data-line-total>'+money(lineSale,editor.currency)+'</strong></div><button type="button" class="icon-btn quote-remove" data-remove-item="'+sectionIndex+':'+itemIndex+'" aria-label="Eliminar concepto" '+disabled+'><i data-lucide="x"></i></button><label class="quote-item-notes"><span>'+(editor.proposal_type==='conceptual'?'Funcionalidades o detalle público (una por línea)':'Notas del concepto')+'</span><textarea data-item-field="notes" rows="3" maxlength="2000" placeholder="'+(editor.proposal_type==='conceptual'?'Stock actual por producto\nAlertas por bajo stock\nHistorial de movimientos':'Aclaraciones visibles en la propuesta')+'" '+disabled+'>'+esc(item.notes||'')+'</textarea></label></div>';
}

function renderEditor(){
  const disabled=editor.locked?'disabled':'';
  const conceptual=editor.proposal_type==='conceptual';
  const checks=qualityChecks();
  const documentLabel=conceptual?'propuesta conceptual':'presupuesto';
  $('budgetModalTitle').textContent=editor.id?'Editar '+documentLabel:'Nueva '+documentLabel;
  $('budgetModalSubtitle').textContent=editor.locked?'Documento cerrado. Creá una nueva versión para modificarlo.':conceptual?'Construí una propuesta ejecutiva con objetivos, módulos, resultados e inversión.':'Definí alcance, etapas y conceptos; el total se calcula automáticamente.';
  $('budgetBuilder').innerHTML='<form id="budgetForm" class="quote-builder"><div class="quote-stepbar" aria-label="Flujo del presupuesto"><span class="active"><i data-lucide="clipboard-list"></i>Datos</span><i></i><span class="active"><i data-lucide="layers-3"></i>Etapas</span><i></i><span><i data-lucide="shield-check"></i>Revisión</span><i></i><span><i data-lucide="send"></i>Emisión</span></div><div class="quote-builder-grid"><div class="quote-builder-main"><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">01 · IDENTIFICACIÓN</span><h3>Datos comerciales</h3></div>'+statusPill(editor.status)+'</div><div class="quote-form-grid"><label><span>Oportunidad</span><select data-header="prospect_id" required '+disabled+'>'+prospectOptions()+'</select></label><label><span>Código documental</span><input data-header="document_code" value="'+esc(editor.document_code)+'" maxlength="80" required '+disabled+'></label><label class="full"><span>Título de la propuesta</span><input data-header="title" value="'+esc(editor.title)+'" maxlength="180" required '+disabled+'></label><label class="full"><span>Nombre visible del proyecto</span><input data-header="project_name" value="'+esc(editor.project_name||'')+'" maxlength="180" '+disabled+'></label><label><span>Fecha de emisión</span><input data-header="issue_date" type="date" value="'+esc(editor.issue_date||today())+'" required '+disabled+'></label><label><span>Válida hasta</span><input data-header="valid_until" type="date" value="'+esc(editor.valid_until||'')+'" required '+disabled+'></label><label><span>Moneda</span><select data-header="currency" '+disabled+'><option '+(editor.currency==='ARS'?'selected':'')+'>ARS</option><option '+(editor.currency==='USD'?'selected':'')+'>USD</option></select></label><label><span>Plazo estimado (semanas)</span><input data-header="delivery_weeks" type="number" min="1" max="520" value="'+number(editor.delivery_weeks||4)+'" '+disabled+'></label></div></section><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">02 · ALCANCE</span><h3>Qué incluye y qué queda fuera</h3></div></div><div class="quote-form-grid"><label><span>Alcance incluido</span><textarea data-header="scope" rows="5" maxlength="4000" '+disabled+'>'+esc(editor.scope||'')+'</textarea></label><label><span>Exclusiones y supuestos</span><textarea data-header="exclusions" rows="5" maxlength="4000" '+disabled+'>'+esc(editor.exclusions||'')+'</textarea></label></div></section><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">03 · COSTEO</span><h3>Etapas y conceptos</h3></div><button type="button" class="btn btn-secondary" id="addQuoteSection" '+disabled+'><i data-lucide="plus"></i>Nueva etapa</button></div><div class="quote-stages" id="quoteStages">'+editor.sections.map((section,index)=>sectionMarkup(section,index,disabled)).join('')+'</div></section><section class="quote-form-section"><div class="quote-section-title"><div><span class="eyebrow">04 · CONDICIONES</span><h3>Pago, impuestos y notas</h3></div></div><div class="quote-form-grid"><label class="full"><span>Forma de pago</span><input data-header="payment_terms" value="'+esc(editor.payment_terms||'')+'" maxlength="500" '+disabled+'></label><label><span>Descuento general %</span><input data-header="discount_percent" type="number" min="0" max="100" step="0.01" value="'+number(editor.discount_percent)+'" '+disabled+'></label><label><span>Impuestos %</span><input data-header="tax_percent" type="number" min="0" max="100" step="0.01" value="'+number(editor.tax_percent)+'" '+disabled+'></label><label class="full"><span>Notas comerciales</span><textarea data-header="notes" rows="3" maxlength="2000" '+disabled+'>'+esc(editor.notes||'')+'</textarea></label><label><span>Estado</span><select data-header="status" '+disabled+'>'+statusOptions()+'</select></label><label><span>Motivo de la versión</span><input data-header="change_reason" value="'+esc(editor.change_reason||'')+'" maxlength="500" '+disabled+'></label></div></section></div><aside class="quote-summary"><div class="quote-summary-card"><span class="eyebrow">RESUMEN ECONÓMICO</span><div class="quote-summary-client"><small>Oportunidad</small><strong id="quoteProspectName">'+esc(prospect(editor.prospect_id)?.business_name||'Sin seleccionar')+'</strong></div><dl><div><dt>Costo interno</dt><dd id="quoteCost">-</dd></div><div><dt>Venta antes de descuento</dt><dd id="quoteSale">-</dd></div><div><dt>Descuento</dt><dd id="quoteDiscount">-</dd></div><div><dt>Subtotal</dt><dd id="quoteSubtotal">-</dd></div><div><dt>Impuestos</dt><dd id="quoteTax">-</dd></div><div class="quote-total"><dt>Total final</dt><dd id="quoteTotal">-</dd></div></dl></div><div class="quote-quality"><span class="eyebrow">CONTROL PREVIO</span><div id="quoteQuality">'+checks.map(([label,ok])=>'<div class="'+(ok?'ok':'pending')+'"><i data-lucide="'+(ok?'check-circle-2':'circle-dashed')+'"></i><span>'+label+'</span></div>').join('')+'</div></div></aside></div><div class="quote-form-actions"><div><span class="quote-version-chip">'+esc(editor.document_code)+' · v'+number(editor.version||1)+'</span></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="budgetModal">Cerrar</button>'+(!editor.locked?'<button type="submit" class="btn btn-primary"><i data-lucide="save"></i>Guardar presupuesto</button>':'')+'</div></div></form>';
  const sections=$('budgetForm').querySelectorAll('.quote-form-section');
  const identityGrid=sections[0].querySelector('.quote-form-grid');
  identityGrid.insertAdjacentHTML('afterbegin','<label><span>Tipo de documento</span><select data-header="proposal_type" '+disabled+'>'+Object.entries(PROPOSAL_TYPES).map(([value,label])=>'<option value="'+value+'" '+(editor.proposal_type===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+(conceptual?'<label><span>Presentación de precios</span><select data-header="pricing_display" '+disabled+'>'+Object.entries(PRICING_DISPLAYS).map(([value,label])=>'<option value="'+value+'" '+(editor.pricing_display===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>':''));
  if(conceptual){
    identityGrid.insertAdjacentHTML('beforeend','<label class="full"><span>Subtítulo de portada</span><input data-header="cover_subtitle" value="'+esc(editor.cover_subtitle||'')+'" maxlength="300" placeholder="Una propuesta clara para transformar la operación" '+disabled+'></label><label class="full quote-cover-option"><span>Presentación</span><span class="quote-toggle"><input data-header="cover_enabled" type="checkbox" '+(editor.cover_enabled?'checked':'')+' '+disabled+'><i aria-hidden="true"></i><b>Agregar portada ejecutiva al PDF</b></span></label>');
    const scopeGrid=sections[1].querySelector('.quote-form-grid');
    scopeGrid.insertAdjacentHTML('afterbegin','<label class="full"><span>Resumen ejecutivo</span><textarea data-header="executive_summary" rows="5" maxlength="8000" placeholder="Situación actual, oportunidad y propuesta de valor" '+disabled+'>'+esc(editor.executive_summary||'')+'</textarea></label><label class="full"><span>Objetivo de la propuesta</span><textarea data-header="objective" rows="3" maxlength="4000" placeholder="Resultado concreto que se busca alcanzar" '+disabled+'>'+esc(editor.objective||'')+'</textarea></label>');
    sections[1].querySelector('h3').textContent='Historia, objetivo y alcance';
    sections[2].querySelector('h3').textContent='Módulos y conceptos';
    const addSection=$('addQuoteSection');
    addSection.innerHTML='<i data-lucide="plus"></i>Nuevo módulo';
    const stepLabels=$('budgetForm').querySelectorAll('.quote-stepbar span');
    if(stepLabels[1])stepLabels[1].innerHTML='<i data-lucide="layers-3"></i>Módulos';
  }
  const submit=$('budgetForm').querySelector('button[type="submit"]');
  if(submit)submit.innerHTML='<i data-lucide="save"></i>Guardar '+documentLabel;
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
  if(header){
    editor[header]=event.target.type==='checkbox'?event.target.checked:event.target.type==='number'?number(event.target.value):event.target.value;
    if(header==='proposal_type'){
      if(editor.proposal_type==='conceptual'){
        editor.cover_enabled=true;
        editor.pricing_display='section_total';
        editor.sections.forEach(section=>section.items.forEach(item=>{if(item.unit==='hora')item.unit='concepto'}));
      }else{
        editor.cover_enabled=false;
        editor.pricing_display='itemized';
      }
      renderEditor();
      return;
    }
    if(header==='prospect_id')$('quoteProspectName').textContent=prospect(editor.prospect_id)?.business_name||'Sin seleccionar';
    if(['currency','status'].includes(header)){renderEditor();return}
    updateCalculations();
    return;
  }
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
  if(editor.proposal_type==='conceptual'&&editor.executive_summary.trim().length<30)return 'Completá el resumen ejecutivo de la propuesta conceptual.';
  if(editor.proposal_type==='conceptual'&&editor.objective.trim().length<10)return 'Completá el objetivo de la propuesta conceptual.';
  if(!editor.sections.length)return editor.proposal_type==='conceptual'?'Agregá al menos un módulo.':'Agregá al menos una etapa.';
  for(const section of editor.sections){
    if(section.title.trim().length<2)return 'Cada '+(editor.proposal_type==='conceptual'?'módulo':'etapa')+' necesita un nombre.';
    if(!section.items.length)return 'Cada '+(editor.proposal_type==='conceptual'?'módulo':'etapa')+' necesita al menos un concepto.';
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
    proposal_type:editor.proposal_type,pricing_display:editor.pricing_display,cover_enabled:editor.cover_enabled,
    cover_subtitle:editor.cover_subtitle.trim(),executive_summary:editor.executive_summary.trim(),objective:editor.objective.trim(),
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
  const conceptual=item.proposal_type==='conceptual';
  const pricingDisplay=item.pricing_display||'itemized';
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  const brand=org.name||'Soluciones Conectadas';
  const contactEmail=org.contact_email||'contacto.solucionesconectadas@gmail.com';
  const contactPhone=org.phone||'03442 47-2233';
  const website='scsolucionesconectadas.com.ar';
  let logo=null;
  try{logo=await imageAsPng('./assets/img/sc-isotipo-color.webp')}catch{}

  const drawLogo=(x,top,width)=>{
    if(!logo)return;
    const height=width/logo.ratio;
    doc.addImage(logo.data,'PNG',x,top,width,height);
  };
  const drawHeader=()=>{
    drawLogo(16,11,18);
    doc.setTextColor(31,47,60);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(brand,39,16);
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(94,115,130);doc.text('AUTOMATIZACIÓN E INTEGRACIÓN PARA EMPRESAS',39,21);
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(31,47,60);doc.text(conceptual?'PROPUESTA CONCEPTUAL':'PRESUPUESTO COMERCIAL',194,15,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(94,115,130);doc.text((item.document_code||'PRE')+' · v'+number(item.version||1),194,21,{align:'right'});
    doc.setDrawColor(211,224,233);doc.setLineWidth(.35);doc.line(16,30,194,30);
  };
  const addContentPage=()=>{doc.addPage();drawHeader();y=41};
  const ensureSpace=space=>{if(y+space>270)addContentPage()};
  const lineSubtotal=line=>number(line.subtotal_sale)||number(line.quantity)*number(line.unit_cost)*(1+number(line.margin_percent)/100);
  const short=(value,length=54)=>{const text=String(value||'No informado');return text.length>length?text.slice(0,length-1)+'…':text};
  const writeNarrative=(title,text)=>{
    const lines=doc.splitTextToSize(String(text||'No especificado.'),172);
    ensureSpace(13);
    doc.setFillColor(49,165,214);doc.rect(16,y-4,2,8,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(3,96,189);doc.text(title,22,y);y+=7;
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(31,47,60);
    for(const line of lines){ensureSpace(5);doc.text(line,22,y);y+=4.2}
    y+=5;
  };

  if(conceptual&&item.cover_enabled){
    doc.setFillColor(31,47,60);doc.rect(0,0,210,58,'F');
    doc.setFillColor(49,165,214);doc.rect(0,0,6,297,'F');
    drawLogo(20,18,24);
    doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(255,255,255);doc.text(brand,51,27);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(192,230,247);doc.text('SOLUCIONES CONECTADAS PARA OPERACIONES REALES',51,34);
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(3,96,189);doc.text('PROPUESTA CONCEPTUAL',20,88);
    doc.setFontSize(26);doc.setTextColor(31,47,60);
    const coverTitle=doc.splitTextToSize(String(item.title||'Propuesta comercial'),164);
    doc.text(coverTitle,20,104);
    let coverY=104+coverTitle.length*10+8;
    if(item.cover_subtitle){doc.setFont('helvetica','normal');doc.setFontSize(12);doc.setTextColor(94,115,130);coverY=pdfText(doc,item.cover_subtitle,20,coverY,158,6)+10}
    doc.setDrawColor(211,224,233);doc.line(20,coverY,190,coverY);coverY+=17;
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(94,115,130);doc.text('PREPARADA PARA',20,coverY);
    doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(31,47,60);doc.text(short(lead.business_name||'Cliente',48),20,coverY+9);
    const moduleNames=sections.map(section=>section.title).filter(Boolean).slice(0,4);
    if(moduleNames.length){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(94,115,130);doc.text('Módulos: '+moduleNames.join(' · '),20,coverY+20,{maxWidth:166})}
    doc.setFillColor(245,249,252);doc.roundedRect(20,238,170,25,2,2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(94,115,130);doc.text('DOCUMENTO',27,247);doc.text('VERSIÓN',91,247);doc.text('EMISIÓN',132,247);
    doc.setFontSize(9);doc.setTextColor(31,47,60);doc.text(item.document_code||'PRE',27,255);doc.text('v'+number(item.version||1),91,255);doc.text(app.format.fmtDate(item.issue_date||item.created_at),132,255);
    doc.addPage();
  }

  drawHeader();
  let y=43;
  doc.setFont('helvetica','bold');doc.setFontSize(19);doc.setTextColor(31,47,60);
  const titleLines=doc.splitTextToSize(String(item.title||'Propuesta comercial'),112);doc.text(titleLines,16,y);
  doc.setFillColor(236,247,252);doc.roundedRect(138,38,56,29,2,2,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(3,96,189);doc.text('INVERSIÓN TOTAL',144,47);
  doc.setFontSize(13);doc.setTextColor(31,47,60);doc.text(money(item.amount,item.currency),188,59,{align:'right',maxWidth:44});
  y=Math.max(76,43+titleLines.length*7+8);

  const metadata=[
    ['CLIENTE / OPORTUNIDAD',lead.business_name||'Sin identificar'],
    ['PROYECTO',item.project_name||item.title],
    ['ESTADO',STATUS_LABELS[item.status]||item.status],
    ['VIGENCIA','Hasta '+app.format.fmtDate(item.valid_until)],
    ['PLAZO ESTIMADO',(item.delivery_weeks||'-')+' semanas'],
    ['MONEDA',item.currency||'ARS']
  ];
  metadata.forEach(([label,value],index)=>{
    const column=index%2,row=Math.floor(index/2),x=16+column*91,top=y+row*20;
    doc.setFillColor(247,250,252);doc.setDrawColor(224,233,239);doc.roundedRect(x,top,87,16,2,2,'FD');
    doc.setFont('helvetica','bold');doc.setFontSize(5.8);doc.setTextColor(94,115,130);doc.text(label,x+5,top+5);
    doc.setFontSize(8);doc.setTextColor(31,47,60);doc.text(short(value,44),x+5,top+11.5);
  });
  y+=66;

  if(conceptual){
    writeNarrative('RESUMEN EJECUTIVO',item.executive_summary);
    writeNarrative('OBJETIVO DE LA PROPUESTA',item.objective);
  }
  writeNarrative('ALCANCE INCLUIDO',item.scope);

  for(const [sectionIndex,section] of sections.entries()){
    ensureSpace(24);
    doc.setFillColor(31,47,60);doc.roundedRect(16,y-5,178,13,2,2,'F');
    doc.setFillColor(49,165,214);doc.roundedRect(16,y-5,8,13,2,2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(196,232,247);doc.text(String(sectionIndex+1).padStart(2,'0'),20,y+2,{align:'center'});
    doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text(short(section.title,74),29,y+2);
    y+=14;
    if(section.description){
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(94,115,130);
      for(const descriptionLine of doc.splitTextToSize(section.description,168)){ensureSpace(4);doc.text(descriptionLine,20,y);y+=3.8}
      y+=3;
    }
    if(!conceptual){
      ensureSpace(9);doc.setFillColor(247,250,252);doc.rect(20,y-4,170,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(94,115,130);doc.text('CONCEPTO',23,y+1);doc.text('CANT.',132,y+1,{align:'right'});doc.text('P. UNIT.',160,y+1,{align:'right'});doc.text('SUBTOTAL',188,y+1,{align:'right'});y+=10;
    }
    let sectionTotal=0;
    for(const line of section.items){
      const subtotal=lineSubtotal(line);sectionTotal+=subtotal;
      const descriptionLines=doc.splitTextToSize(String(line.description||'Concepto'),conceptual?128:98);
      const noteLines=String(line.notes||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean).flatMap(value=>doc.splitTextToSize('- '+value,conceptual?158:145));
      ensureSpace(9+descriptionLines.length*4+noteLines.length*3.6);
      doc.setFont('helvetica','bold');doc.setFontSize(conceptual?8.5:7.5);doc.setTextColor(31,47,60);doc.text(descriptionLines,conceptual?24:23,y);
      if(conceptual&&pricingDisplay==='itemized'){doc.setFontSize(8);doc.text(money(subtotal,item.currency),188,y,{align:'right'})}
      if(!conceptual){
        doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.text(number(line.quantity)+' '+line.unit,132,y,{align:'right'});doc.text(money(line.unit_price||number(line.unit_cost)*(1+number(line.margin_percent)/100),item.currency),160,y,{align:'right'});doc.text(money(subtotal,item.currency),188,y,{align:'right'});
      }
      y+=descriptionLines.length*4+1;
      if(conceptual){
        doc.setFont('helvetica','normal');doc.setFontSize(6.7);doc.setTextColor(3,96,189);doc.text(String(line.category||'Solución').toUpperCase(),24,y);y+=4;
      }
      if(noteLines.length){doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(94,115,130);for(const noteLine of noteLines){ensureSpace(4);doc.text(noteLine,conceptual?28:24,y);y+=3.6}}
      doc.setDrawColor(232,238,242);doc.line(20,y+2,190,y+2);y+=7;
    }
    if(pricingDisplay!=='total_only'){
      ensureSpace(10);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(31,47,60);doc.text(conceptual?'Inversión del módulo':'Total etapa',158,y,{align:'right'});doc.text(money(sectionTotal,item.currency),190,y,{align:'right'});y+=11;
    }else y+=3;
  }

  writeNarrative('EXCLUSIONES Y SUPUESTOS',item.exclusions);
  ensureSpace(49);
  const saleBeforeDiscount=sections.flatMap(section=>section.items).reduce((sum,line)=>sum+lineSubtotal(line),0);
  const discount=Math.max(0,saleBeforeDiscount-number(item.subtotal_sale));
  doc.setFillColor(31,47,60);doc.roundedRect(16,y,178,38,3,3,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(197,232,247);doc.text('INVERSIÓN PROPUESTA',24,y+10);
  doc.setFontSize(19);doc.setTextColor(255,255,255);doc.text(money(item.amount,item.currency),186,y+24,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(218,229,236);doc.text('Base '+money(saleBeforeDiscount,item.currency)+(discount?' · Descuento '+money(discount,item.currency):'')+' · Impuestos '+number(item.tax_percent)+'%',24,y+31,{maxWidth:150});
  y+=48;
  writeNarrative('CONDICIONES COMERCIALES','Forma de pago: '+(item.payment_terms||'A convenir')+'. Plazo estimado: '+(item.delivery_weeks||'-')+' semanas. Vigencia: hasta '+app.format.fmtDate(item.valid_until)+'.');
  if(item.notes)writeNarrative('NOTAS COMERCIALES',item.notes);
  if(conceptual){
    ensureSpace(42);
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(3,96,189);doc.text('PRÓXIMOS PASOS',16,y);y+=7;
    const nextSteps=[['01','Validar alcance y prioridades'],['02','Confirmar inversión y cronograma'],['03','Iniciar relevamiento detallado']];
    nextSteps.forEach(([step,label],index)=>{
      const x=16+index*60;
      doc.setFillColor(247,250,252);doc.setDrawColor(224,233,239);doc.roundedRect(x,y,56,24,2,2,'FD');
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(49,165,214);doc.text(step,x+5,y+8);
      doc.setFontSize(7.2);doc.setTextColor(31,47,60);doc.text(doc.splitTextToSize(label,43),x+5,y+14);
    });
    y+=32;
    ensureSpace(26);
    doc.setFillColor(236,247,252);doc.roundedRect(16,y,178,21,2,2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(31,47,60);doc.text('Conversemos sobre el alcance final',23,y+8);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(94,115,130);doc.text(contactEmail+' · '+contactPhone,23,y+15);
  }

  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);
    if(!['enviada','aceptada'].includes(item.status)){
      doc.setFont('helvetica','bold');doc.setFontSize(40);doc.setTextColor(236,240,243);doc.text('BORRADOR',105,160,{align:'center',angle:35});
    }
    doc.setDrawColor(211,224,233);doc.line(16,277,194,277);
    drawLogo(16,282,10);
    doc.setFont('helvetica','bold');doc.setFontSize(5.7);doc.setTextColor(94,115,130);doc.text('ELABORADO POR',30,283);
    doc.setFontSize(7);doc.setTextColor(31,47,60);doc.text(brand,30,288);
    doc.setFont('helvetica','normal');doc.setFontSize(5.8);doc.setTextColor(94,115,130);doc.text(contactEmail+' · '+contactPhone,105,284,{align:'center'});doc.text(website,105,289,{align:'center'});
    doc.setFont('helvetica','bold');doc.setTextColor(31,47,60);doc.text('PÁGINA '+page+' / '+pages,194,287,{align:'right'});
  }
  doc.save((item.document_code||'presupuesto')+'-v'+number(item.version||1)+'.pdf');
  app.notify((conceptual?'Propuesta conceptual':'Presupuesto')+' generado en PDF');
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
