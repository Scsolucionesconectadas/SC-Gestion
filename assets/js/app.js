import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm';
import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/+esm';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.23/+esm';

const cfg = window.SC_CONFIG || {};
const configured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY);
const supabase = configured
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

const STATUSES = [
  'Prospecto','Visitado','Contactado','Respondió','Interesado',
  'Reunión pendiente','Reunión realizada','Propuesta enviada',
  'Negociación','Cliente','No interesado'
];
const INTERACTION_TYPES = ['WhatsApp','Llamada','Visita','Email','Reunión','Videollamada','Nota'];
const VIEW_META = {
  dashboard:['Inicio','OPERACIÓN CONECTADA'],
  prospects:['Oportunidades','BASE COMERCIAL'],
  pipeline:['Pipeline','OPORTUNIDADES'],
  clients:['Clientes','RELACIONES'],
  projects:['Proyectos','ENTREGAS'],
  followups:['Seguimientos','AGENDA COMERCIAL'],
  tasks:['Tareas','ORGANIZACIÓN'],
  documents:['Documentos','TRAZABILIDAD'],
  billing:['Administración','CONTROL INTERNO'],
  reports:['Reportes','ANÁLISIS'],
  team:['Equipo','ACCESOS']
};
const DEMO_KEY = 'sc_crm_demo_v2';
const THEME_KEY = 'sc_crm_theme';
const ORG_KEY = 'sc_gestion_active_organization';
const ROLE_LABELS = {
  owner:'Propietario',admin:'Administrador',commercial:'Comercial',
  project_manager:'Responsable de proyectos',accounting:'Administración',
  collaborator:'Colaborador',viewer:'Solo lectura'
};
const FINANCE_ROLES = new Set(['owner','admin','accounting']);
const WRITE_ROLES = new Set(['owner','admin','commercial','project_manager','accounting','collaborator']);

let mode = configured ? 'supabase' : 'demo';
let currentUser = null;
let currentProfile = null;
let memberships = [];
let organizations = [];
let currentMembership = null;
let activeOrganization = null;
let activeView = 'dashboard';
let realtimeChannel = null;
let reloadTimer = null;
let charts = [];
let data = {
  profiles: [],
  prospects: [],
  interactions: [],
  tasks: [],
  meetings: [],
  proposals: [],
  clients: [],
  projects: [],
  documents: [],
  invoices: [],
  payments: [],
  organizationMemberships: []
};

const $ = (id) => document.getElementById(id);
const esc = (value='') => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid = () => crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
const isoDate = () => dayjs().format('YYYY-MM-DD');
const fmtDate = (value) => value ? dayjs(value).format('DD/MM/YYYY') : 'Sin fecha';
const fmtDateTime = (value) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—';
const daysFromToday = (value) => value ? dayjs(value).startOf('day').diff(dayjs().startOf('day'),'day') : 9999;
const initials = (name='') => name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'SC';
const profileById = (id) => data.profiles.find(p => p.id === id);
const ownerName = (id) => profileById(id)?.full_name || 'Sin asignar';
const ownerShort = (id) => ownerName(id).split(' ')[0];
const isReply = (p) => ['Respondió','Interesado','Reunión pendiente','Reunión realizada','Propuesta enviada','Negociación','Cliente'].includes(p.status);
const isOpportunity = (p) => ['Interesado','Reunión pendiente','Reunión realizada','Propuesta enviada','Negociación','Cliente'].includes(p.status);
const activeProspect = (p) => !['Cliente','No interesado'].includes(p.status);
const activeOrganizationId = () => activeOrganization?.id || null;
const roleLabel = (role) => ROLE_LABELS[role] || 'Sin rol';
const canWrite = () => WRITE_ROLES.has(currentMembership?.role);
const canManageFinance = () => FINANCE_ROLES.has(currentMembership?.role);
const projectById = (id) => data.projects.find(project => project.id === id);
const clientById = (id) => data.clients.find(client => client.id === id);
const invoiceById = (id) => data.invoices.find(invoice => invoice.id === id);
const labelFrom = (value='') => String(value).replaceAll('_',' ').replace(/(^|\s)\S/g, letter => letter.toUpperCase());
const PROJECT_STATUS_LABELS = {
  planned:'Planificado',in_progress:'En curso',waiting:'En espera',review:'En revisión',
  completed:'Completado',cancelled:'Cancelado'
};
const DOCUMENT_STATUS_LABELS = {
  draft:'Borrador',pending_review:'En revisión',approved:'Aprobado',expired:'Vencido',archived:'Archivado'
};
const INVOICE_STATUS_LABELS = {
  draft:'Borrador',pending_approval:'Pendiente de aprobación',issued:'Emitido',
  partially_paid:'Pago parcial',paid:'Pagado',overdue:'Vencido',cancelled:'Cancelado'
};
const DOCUMENT_CATEGORY_LABELS = {
  general:'General',contract:'Contrato',proposal:'Propuesta',invoice:'Comprobante',
  receipt:'Recibo',technical:'Técnico',legal:'Legal'
};

function businessStatusClass(status){
  if(['active','completed','approved','paid'].includes(status)) return 'status-green';
  if(['in_progress','issued','partially_paid','pending_review','review'].includes(status)) return 'status-blue';
  if(['planned','waiting','draft','pending_approval'].includes(status)) return 'status-amber';
  if(['cancelled','expired','overdue','inactive'].includes(status)) return 'status-red';
  return 'status-gray';
}
function businessPill(status,labels={}){
  return '<span class="status-pill '+businessStatusClass(status)+'">'+esc(labels[status]||labelFrom(status))+'</span>';
}

function lucideRefresh(){ if(window.lucide) window.lucide.createIcons(); }
function notify(message){
  const t=$('toast'); t.textContent=message; t.hidden=false;
  clearTimeout(window.__scToast); window.__scToast=setTimeout(()=>t.hidden=true,2200);
}
function statusClass(status){
  if(status==='Cliente'||status==='Reunión realizada') return 'status-green';
  if(status==='Interesado'||status==='Reunión pendiente'||status==='Negociación') return 'status-amber';
  if(status==='Respondió'||status==='Propuesta enviada') return 'status-purple';
  if(status==='No interesado') return 'status-red';
  if(status==='Contactado'||status==='Visitado') return 'status-blue';
  return 'status-gray';
}
function statusPill(status){ return '<span class="status-pill '+statusClass(status)+'">'+esc(status)+'</span>'; }
function emptyState(text, icon='inbox'){
  return '<div class="empty-state"><i data-lucide="'+icon+'"></i><div>'+esc(text)+'</div></div>';
}
function dateLabel(date){
  const d=daysFromToday(date);
  if(!date) return 'Sin fecha';
  if(d<0) return 'Vencido · '+fmtDate(date);
  if(d===0) return 'Hoy';
  if(d===1) return 'Mañana';
  return fmtDate(date);
}
function setSync(label,sub,ok=true){
  $('syncLabel').textContent=label;
  $('syncSub').textContent=sub;
  const dot=document.querySelector('.sync-orbit span');
  if(dot) dot.style.background=ok?'var(--sc-cyan)':'var(--red)';
}
function openModal(id){ $(id).hidden=false; lucideRefresh(); }
function closeModal(id){ $(id).hidden=true; }
function ownerOptions(selected=''){
  return data.profiles.filter(p=>p.active!==false).map(p=>'<option value="'+p.id+'" '+(p.id===selected?'selected':'')+'>'+esc(p.full_name)+'</option>').join('');
}

async function init(){
  bindStaticEvents();
  if(localStorage.getItem(THEME_KEY)==='dark') document.body.classList.add('dark');

  if(!configured){
    $('setupBox').hidden=false;
    $('authMessage').textContent='Conectá Supabase para habilitar los usuarios reales.';
    $('loginButton').disabled=true;
    lucideRefresh();
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if(sessionData.session){
    await enterAuthenticated(sessionData.session.user);
  } else {
    showAuth();
  }

  supabase.auth.onAuthStateChange(async (event,session)=>{
    if(event==='SIGNED_OUT'){
      currentUser=null; currentProfile=null; teardownRealtime(); showAuth();
    }
  });
  lucideRefresh();
}

function showAuth(){
  $('authShell').hidden=false;
  $('appShell').hidden=true;
  $('loginPassword').value='';
}
async function enterAuthenticated(user){
  currentUser=user;
  mode='supabase';
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id',user.id).single();
  if(error || !profile?.active){
    $('authMessage').textContent='Tu usuario no tiene acceso activo al CRM.';
    await supabase.auth.signOut();
    return;
  }
  currentProfile=profile;
  const { data: membershipRows, error: membershipError } = await supabase
    .from('memberships')
    .select('id,organization_id,role,active,organizations(id,name,slug,logo_url,default_currency,status)')
    .eq('user_id', user.id)
    .eq('active', true);
  if(membershipError || !membershipRows?.length){
    $('authMessage').textContent='Tu usuario no está asignado a una empresa activa.';
    await supabase.auth.signOut();
    return;
  }
  memberships=membershipRows;
  organizations=membershipRows.map(row=>row.organizations).filter(Boolean);
  const storedOrganization=localStorage.getItem(ORG_KEY);
  currentMembership=memberships.find(row=>row.organization_id===storedOrganization)||memberships[0];
  activeOrganization=currentMembership.organizations;
  localStorage.setItem(ORG_KEY,activeOrganization.id);
  $('authShell').hidden=true;
  $('appShell').hidden=false;
  renderOrganizationSwitcher();
  applyUserIdentity();
  setSync('Conectado','Supabase · tiempo real');
  await loadRemoteData();
  setupRealtime();
  setView('dashboard');
  if (currentProfile?.must_change_password) {
    setTimeout(() => {
      openAction('changePassword');
      notify('Por seguridad, cambiá la contraseña inicial.');
    }, 250);
  }
}
function enterDemo(){
  mode='demo';
  currentProfile={id:'demo-maikol',username:'mbetancourt',full_name:'Maikol Betancourt',role:'admin',active:true};
  currentUser={id:'demo-maikol'};
  activeOrganization={id:'demo-sc',name:'Soluciones Conectadas',slug:'soluciones-conectadas',default_currency:'ARS',status:'active'};
  organizations=[activeOrganization];
  currentMembership={organization_id:activeOrganization.id,user_id:currentUser.id,role:'owner',active:true,organizations:activeOrganization};
  memberships=[currentMembership];
  data=loadDemoData();
  $('authShell').hidden=true;
  $('appShell').hidden=false;
  renderOrganizationSwitcher();
  applyUserIdentity();
  setSync('Demo local','Sin conexión a Supabase');
  renderAll();
  setView('dashboard');
}
function applyUserIdentity(){
  const n=currentProfile?.full_name || 'Usuario';
  $('userName').textContent=n.split(' ')[0];
  $('userRole').textContent=roleLabel(currentMembership?.role);
  $('userAvatar').textContent=initials(n);
  const hour=new Date().getHours();
  const greeting=hour<12?'Buenos días':hour<19?'Buenas tardes':'Buenas noches';
  $('heroGreeting').textContent=greeting+', '+n.split(' ')[0]+'.';
}

function renderOrganizationSwitcher(){
  const select=$('organizationSelect');
  select.innerHTML=memberships.map(item=>'<option value="'+item.organization_id+'">'+esc(item.organizations?.name||'Empresa')+'</option>').join('');
  select.value=activeOrganization?.id||'';
  document.querySelectorAll('[data-role-scope="finance"]').forEach(element=>element.hidden=!canManageFinance());
  ['newProspectBtn','quickInteractionBtn','newTaskBtn','newClientBtn','newProjectBtn','newDocumentBtn'].forEach(id=>{
    const element=$(id);if(element)element.hidden=!canWrite();
  });
  if($('newInvoiceBtn'))$('newInvoiceBtn').hidden=!canManageFinance();
}

async function switchOrganization(organizationId){
  const membership=memberships.find(item=>item.organization_id===organizationId);
  if(!membership||membership.active===false)return;
  currentMembership=membership;
  activeOrganization=membership.organizations;
  localStorage.setItem(ORG_KEY,organizationId);
  applyUserIdentity();
  renderOrganizationSwitcher();
  teardownRealtime();
  await loadRemoteData();
  setupRealtime();
  setView('dashboard');
  notify('Empresa activa: '+activeOrganization.name);
}

async function login(event){
  event.preventDefault();
  if(!configured) return;
  const username=$('loginUser').value.trim().toLowerCase();
  const password=$('loginPassword').value;
  const email=username+'@'+(cfg.AUTH_DOMAIN||'crm.sc.local');
  $('authMessage').textContent='';
  $('loginButton').disabled=true;
  $('loginButton').querySelector('span').textContent='Ingresando...';

  const { data: auth, error } = await supabase.auth.signInWithPassword({email,password});
  $('loginButton').disabled=false;
  $('loginButton').querySelector('span').textContent='Ingresar';

  if(error){
    $('authMessage').textContent='Usuario o contraseña incorrectos.';
    return;
  }
  await enterAuthenticated(auth.user);
}
async function logout(){
  if(mode==='supabase' && supabase) await supabase.auth.signOut();
  else showAuth();
}

async function loadRemoteData(){
  const organizationId=activeOrganizationId();
  if(!organizationId)return;
  setSync('Sincronizando','PostgreSQL');
  const membersQuery=await supabase.from('memberships')
    .select('user_id,role,active')
    .eq('organization_id',organizationId)
    .eq('active',true);
  const profileIds=(membersQuery.data||[]).map(item=>item.user_id);
  const queries = await Promise.all([
    profileIds.length?supabase.from('profiles').select('*').in('id',profileIds).order('full_name'):Promise.resolve({data:[],error:null}),
    supabase.from('prospects').select('*').eq('organization_id',organizationId).order('updated_at',{ascending:false}),
    supabase.from('interactions').select('*').eq('organization_id',organizationId).order('happened_at',{ascending:false}).limit(1000),
    supabase.from('tasks').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    supabase.from('meetings').select('*').eq('organization_id',organizationId).order('starts_at',{ascending:true}),
    supabase.from('proposals').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}),
    supabase.from('clients').select('*').eq('organization_id',organizationId).order('business_name'),
    supabase.from('projects').select('*').eq('organization_id',organizationId).order('updated_at',{ascending:false}),
    supabase.from('documents').select('*').eq('organization_id',organizationId).order('updated_at',{ascending:false}),
    canManageFinance()?supabase.from('invoices').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
    canManageFinance()?supabase.from('payments').select('*').eq('organization_id',organizationId).order('paid_at',{ascending:false}):Promise.resolve({data:[],error:null})
  ]);
  const names=['profiles','prospects','interactions','tasks','meetings','proposals','clients','projects','documents','invoices','payments'];
  let failed=Boolean(membersQuery.error);
  queries.forEach((q,i)=>{ if(q.error){ console.error(names[i],q.error); failed=true; } else data[names[i]]=q.data||[]; });
  data.organizationMemberships=membersQuery.data||[];
  setSync(failed?'Con advertencias':'Conectado',failed?'Revisar consola':'Supabase · tiempo real',!failed);
  renderAll();
}
function setupRealtime(){
  teardownRealtime();
  const organizationId=activeOrganizationId();
  if(!organizationId)return;
  realtimeChannel=supabase.channel('sc-gestion-'+organizationId);
  ['prospects','interactions','tasks','meetings','proposals','clients','projects','documents','invoices','payments'].forEach(table=>{
    realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table,filter:'organization_id=eq.'+organizationId},scheduleReload);
  });
  realtimeChannel.subscribe();
}
function teardownRealtime(){
  if(realtimeChannel && supabase){ supabase.removeChannel(realtimeChannel); realtimeChannel=null; }
}
function scheduleReload(){
  clearTimeout(reloadTimer);
  reloadTimer=setTimeout(()=>loadRemoteData(),450);
}

function loadDemoData(){
  const saved=localStorage.getItem(DEMO_KEY);
  if(saved){
    try{
      return normalizeDemoData({clients:[],projects:[],documents:[],invoices:[],payments:[],organizationMemberships:[],...JSON.parse(saved)});
    }catch{}
  }
  const p1='demo-maikol',p2='demo-alexis',p3='demo-oriana';
  const profiles=[
    {id:p1,username:'mbetancourt',full_name:'Maikol Betancourt',role:'admin',active:true},
    {id:p2,username:'areyes',full_name:'Alexis Reyes',role:'commercial',active:true},
    {id:p3,username:'orojas',full_name:'Oriana Rojas',role:'commercial',active:true}
  ];
  const prospects=[
    {id:uuid(),business_name:'Distribuidora Norte · Demo',sector:'Mayorista distribuidor',city:'Cdelu',contact_name:'Marina',job_title:'Dueña',phone:'3442000001',email:'',need_interest:'Integrar pedidos, stock, entregas y reportes.',brand:'SC',status:'Reunión pendiente',next_action:'Coordinar reunión',next_followup:isoDate(),notes:'Respondió con interés.',owner_id:p1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()},
    {id:uuid(),business_name:'Estudio Delta · Demo',sector:'Arquitectura',city:'Cdelu',contact_name:'Juan',job_title:'Arquitecto',phone:'3442000002',email:'',need_interest:'Gestión de proyectos y documentación.',brand:'SC',status:'Contactado',next_action:'WhatsApp',next_followup:dayjs().add(2,'day').format('YYYY-MM-DD'),notes:'Primer contacto enviado.',owner_id:p2,created_at:new Date().toISOString(),updated_at:new Date().toISOString()},
    {id:uuid(),business_name:'Clínica Centro · Demo',sector:'Salud',city:'Cdelu',contact_name:'Ana',job_title:'Administración',phone:'3442000003',email:'',need_interest:'Turnos, recordatorios y reportería.',brand:'SC y Click',status:'Interesado',next_action:'Preparar demo',next_followup:dayjs().add(1,'day').format('YYYY-MM-DD'),notes:'Pidió ver una demo.',owner_id:p3,created_at:new Date().toISOString(),updated_at:new Date().toISOString()},
    {id:uuid(),business_name:'Taller Ruta · Demo',sector:'Automotor',city:'Cdelu',contact_name:'Pablo',job_title:'Dueño',phone:'3442000004',email:'',need_interest:'Órdenes de trabajo e historial de vehículos.',brand:'SC',status:'Propuesta enviada',next_action:'Esperar respuesta',next_followup:dayjs().add(4,'day').format('YYYY-MM-DD'),notes:'Propuesta enviada.',owner_id:p1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
  ];
  const interactions=prospects.map((p,i)=>({id:uuid(),prospect_id:p.id,user_id:p.owner_id,type:'WhatsApp',result:i===0?'Respondió y pidió reunión':'Primer contacto enviado',next_step:p.next_action,next_date:p.next_followup,notes:'',happened_at:dayjs().subtract(i,'hour').toISOString(),created_at:new Date().toISOString()}));
  const tasks=[
    {id:uuid(),prospect_id:prospects[0].id,assigned_to:p1,created_by:p1,title:'Preparar preguntas para reunión',description:'Revisar proceso actual y sistemas.',priority:'alta',status:'pendiente',due_at:dayjs().add(1,'day').hour(9).toISOString(),created_at:new Date().toISOString()},
    {id:uuid(),prospect_id:prospects[2].id,assigned_to:p3,created_by:p3,title:'Armar demo de turnos',description:'Adaptar ejemplos al centro.',priority:'media',status:'en_progreso',due_at:dayjs().add(2,'day').toISOString(),created_at:new Date().toISOString()}
  ];
  const meetings=[{id:uuid(),prospect_id:prospects[0].id,owner_id:p1,starts_at:dayjs().add(1,'day').hour(10).minute(0).toISOString(),duration_minutes:30,modality:'Presencial',location:'Concepción del Uruguay',agenda:'Relevamiento inicial',result:null,next_step:null,status:'programada'}];
  const proposals=[{id:uuid(),prospect_id:prospects[3].id,created_by:p1,title:'Sistema de órdenes de trabajo',amount:450000,currency:'ARS',status:'enviada',sent_at:new Date().toISOString(),valid_until:dayjs().add(15,'day').format('YYYY-MM-DD'),notes:'Demo'}];
  const clients=[{id:'demo-client',organization_id:'demo-sc',business_name:'Distribuidora Norte · Demo',contact_name:'Marina',email:'marina@demo.local',phone:'3442000001',city:'Cdelu',status:'active',updated_at:new Date().toISOString()}];
  const projects=[{id:'demo-project',organization_id:'demo-sc',client_id:'demo-client',name:'Portal de pedidos conectado',description:'Centralización de pedidos, stock y entregas.',status:'in_progress',priority:'high',owner_id:p1,start_date:isoDate(),due_date:dayjs().add(30,'day').format('YYYY-MM-DD'),budget:850000,currency:'ARS',progress:42,updated_at:new Date().toISOString()}];
  tasks[0].project_id='demo-project';
  const documents=[{id:'demo-document',organization_id:'demo-sc',project_id:'demo-project',title:'Alcance funcional v1.pdf',category:'proposal',status:'approved',storage_path:null,expires_at:null,updated_at:new Date().toISOString()}];
  const invoices=[{id:'demo-invoice',organization_id:'demo-sc',client_id:'demo-client',project_id:'demo-project',document_type:'invoice',internal_number:'INT-0001',currency:'ARS',total:320000,status:'issued',due_date:dayjs().add(10,'day').format('YYYY-MM-DD'),is_fiscal:false,created_at:new Date().toISOString()}];
  const payments=[];
  const organizationMemberships=profiles.map((profile,index)=>({user_id:profile.id,role:index===0?'owner':'commercial',active:true}));
  const demo=normalizeDemoData({profiles,prospects,interactions,tasks,meetings,proposals,clients,projects,documents,invoices,payments,organizationMemberships});
  localStorage.setItem(DEMO_KEY,JSON.stringify(demo));
  return demo;
}
function normalizeDemoData(demo){
  ['prospects','interactions','tasks','meetings','proposals','clients','projects','documents','invoices','payments'].forEach(key=>{
    demo[key]=(demo[key]||[]).map(item=>({...item,organization_id:item.organization_id||'demo-sc'}));
  });
  if(!(demo.organizationMemberships||[]).length){
    demo.organizationMemberships=(demo.profiles||[]).map((profile,index)=>({user_id:profile.id,role:index===0?'owner':'commercial',active:true}));
  }
  return demo;
}
function saveDemo(){ localStorage.setItem(DEMO_KEY,JSON.stringify(data)); renderAll(); }

function setView(view){
  if(view==='billing'&&!canManageFinance()){
    notify('Tu rol no tiene acceso a administración.');
    return;
  }
  activeView=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $(view+'View').classList.add('active');
  $('viewTitle').textContent=VIEW_META[view][0];
  $('contextLabel').textContent=VIEW_META[view][1];
  $('sidebar').classList.remove('open');
  if(view==='reports') renderReports();
  if(view==='pipeline') setTimeout(enableKanban,0);
  lucideRefresh();
}

function renderAll(){
  renderOwnerControls();
  renderFilters();
  renderDashboard();
  renderProspects();
  renderPipeline();
  renderFollowups();
  renderTasks();
  renderClients();
  renderProjects();
  renderDocuments();
  renderBilling();
  renderTeam();
  if(activeView==='reports') renderReports();
  document.querySelectorAll('button:not([type])').forEach(button=>button.type='button');
  lucideRefresh();
}

function renderOwnerControls(){
  $('owner').innerHTML=ownerOptions(currentProfile?.id || '');
}
function renderFilters(){
  const sf=$('statusFilter'),of=$('ownerFilter'),rf=$('sectorFilter');
  const keep=[sf.value,of.value,rf.value];
  sf.innerHTML='<option value="">Todos los estados</option>'+STATUSES.map(s=>'<option>'+esc(s)+'</option>').join('');
  of.innerHTML='<option value="">Todos los responsables</option>'+data.profiles.filter(p=>p.active!==false).map(p=>'<option value="'+p.id+'">'+esc(p.full_name)+'</option>').join('');
  const sectors=[...new Set(data.prospects.map(p=>p.sector).filter(Boolean))].sort();
  rf.innerHTML='<option value="">Todos los rubros</option>'+sectors.map(s=>'<option>'+esc(s)+'</option>').join('');
  sf.value=keep[0];of.value=keep[1];rf.value=keep[2];
  $('status').innerHTML=STATUSES.map(s=>'<option>'+esc(s)+'</option>').join('');
}
function renderDashboard(){
  const p=data.prospects;
  const meetingsUpcoming=data.meetings.filter(m=>m.status==='programada' && dayjs(m.starts_at).isAfter(dayjs().subtract(1,'hour'))).length;
  const kpis=[
    ['Prospectos',p.length,'users-round','Total en la base'],
    ['Con respuesta',p.filter(isReply).length,'message-circle-reply','Conversaciones abiertas'],
    ['Interesados+',p.filter(isOpportunity).length,'sparkles','Oportunidades activas'],
    ['Reuniones',meetingsUpcoming,'calendar-check-2','Próximas programadas'],
    ['Propuestas',data.proposals.filter(x=>x.status==='enviada').length,'file-check-2','Esperando decisión']
  ];
  $('kpiGrid').innerHTML=kpis.map(k=>'<article class="kpi"><div class="kpi-top"><span class="kpi-label">'+k[0]+'</span><span class="kpi-icon"><i data-lucide="'+k[2]+'"></i></span></div><strong>'+k[1]+'</strong><small>'+k[3]+'</small></article>').join('');

  const priority=p.filter(x=>x.next_followup && activeProspect(x)).sort((a,b)=>a.next_followup.localeCompare(b.next_followup)).slice(0,7);
  $('priorityList').innerHTML=priority.length?priority.map(x=>{
    const d=daysFromToday(x.next_followup);
    const cls=d<0?'status-red':d===0?'status-amber':'status-blue';
    return '<button class="action-item" data-open="'+x.id+'"><span class="item-title"><span class="mini-icon"><i data-lucide="building-2"></i></span><span><b>'+esc(x.business_name)+'</b><small>'+esc(x.next_action||x.status)+' · '+esc(ownerShort(x.owner_id))+'</small></span></span><span class="date-pill '+cls+'">'+dateLabel(x.next_followup)+'</span></button>';
  }).join(''):emptyState('No hay seguimientos pendientes.','calendar-check');

  const groups=STATUSES.map(s=>[s,p.filter(x=>x.status===s).length]).filter(x=>x[1]>0);
  $('funnelList').innerHTML=groups.length?groups.map(x=>'<div class="funnel-item"><span>'+esc(x[0])+'</span><b>'+x[1]+'</b></div>').join(''):emptyState('Sin datos.','chart-no-axes-column');

  const recent=data.interactions.slice().sort((a,b)=>(b.happened_at||'').localeCompare(a.happened_at||'')).slice(0,7);
  $('recentList').innerHTML=recent.length?recent.map(i=>{
    const p=data.prospects.find(x=>x.id===i.prospect_id);
    return '<button class="activity-item" data-open="'+(p?.id||'')+'"><span class="item-title"><span class="mini-icon"><i data-lucide="'+interactionIcon(i.type)+'"></i></span><span><b>'+esc(p?.business_name||'Prospecto')+'</b><small>'+esc(i.type)+' · '+esc(i.result||i.notes||'Interacción registrada')+'</small></span></span><span class="date-pill status-gray">'+fmtDate(i.happened_at)+'</span></button>';
  }).join(''):emptyState('Todavía no hay actividad.','history');

  const max=Math.max(1,...data.profiles.map(o=>p.filter(x=>x.owner_id===o.id).length));
  $('ownerList').innerHTML=data.profiles.filter(o=>o.active!==false).map(o=>{
    const n=p.filter(x=>x.owner_id===o.id).length;
    return '<div class="owner-item"><span class="item-title"><span class="avatar">'+initials(o.full_name)+'</span><span><b>'+esc(o.full_name)+'</b><small>'+esc(o.role==='admin'?'Administrador':'Comercial')+'</small></span></span><span class="owner-bar"><i style="width:'+(n/max*100)+'%"></i></span><b>'+n+'</b></div>';
  }).join('');
}
function interactionIcon(type){
  return ({WhatsApp:'message-circle',Llamada:'phone',Visita:'map-pin',Email:'mail',Reunión:'users',Videollamada:'video',Nota:'sticky-note'})[type]||'activity';
}
function filteredProspects(){
  const q=$('prospectSearch').value.toLowerCase().trim();
  const sf=$('statusFilter').value,of=$('ownerFilter').value,rf=$('sectorFilter').value;
  return data.prospects.filter(p=>{
    const hay=[p.business_name,p.contact_name,p.sector,p.city,p.phone,p.email,p.need_interest].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!sf||p.status===sf)&&(!of||p.owner_id===of)&&(!rf||p.sector===rf);
  });
}
function renderProspects(){
  const list=filteredProspects();
  $('prospectRows').innerHTML=list.length?list.map(p=>'<tr><td><span class="row-main"><b>'+esc(p.business_name)+'</b><small>'+esc(p.contact_name||p.city||'')+'</small></span></td><td>'+esc(p.sector||'—')+'</td><td>'+esc(ownerShort(p.owner_id))+'</td><td>'+statusPill(p.status)+'</td><td>'+esc(p.next_action||'—')+'</td><td>'+fmtDate(p.next_followup)+'</td><td><div class="row-actions"><button class="mini-btn" data-open="'+p.id+'">Ver</button>'+(canWrite()?'<button class="mini-btn" data-edit="'+p.id+'">Editar</button>':'')+'</div></td></tr>').join(''):'<tr><td colspan="7">'+emptyState('No hay resultados para esos filtros.','search-x')+'</td></tr>';
  $('mobileProspects').innerHTML=list.length?list.map(p=>'<article class="mobile-card" data-open="'+p.id+'"><div class="mobile-card-top"><b>'+esc(p.business_name)+'</b>'+statusPill(p.status)+'</div><p>'+esc(p.sector||'Sin rubro')+' · '+esc(ownerShort(p.owner_id))+'</p><small>'+esc(p.next_action||'Sin próxima acción')+' · '+fmtDate(p.next_followup)+'</small></article>').join(''):emptyState('No hay resultados.','search-x');
}
function renderPipeline(){
  const stages=STATUSES.filter(s=>s!=='No interesado');
  $('kanban').innerHTML=stages.map(status=>{
    const items=data.prospects.filter(p=>p.status===status);
    return '<section class="kanban-col" data-status="'+esc(status)+'"><div class="kanban-head"><b>'+esc(status)+'</b><span class="count-pill">'+items.length+'</span></div><div class="kanban-list" data-status="'+esc(status)+'">'+(items.length?items.map(p=>'<article class="lead-card" data-id="'+p.id+'" data-open="'+p.id+'"><b>'+esc(p.business_name)+'</b><p>'+esc(p.sector||'Sin rubro')+'</p><div class="lead-card-foot"><span>'+esc(ownerShort(p.owner_id))+'</span><span>'+fmtDate(p.next_followup)+'</span></div></article>').join(''):'<div class="empty-state">Vacío</div>')+'</div></section>';
  }).join('');
  lucideRefresh();
}
function enableKanban(){
  if(!canWrite())return;
  document.querySelectorAll('.kanban-list').forEach(list=>{
    if(list.__sortable) return;
    list.__sortable=new Sortable(list,{
      group:'crm-pipeline',animation:180,ghostClass:'sortable-ghost',chosenClass:'sortable-chosen',
      onAdd:async evt=>{
        const id=evt.item.dataset.id,status=evt.to.dataset.status;
        await updateProspectStatus(id,status);
      }
    });
  });
}
function renderFollowups(){
  const groups=[
    ['Vencidos','triangle-alert',p=>p.next_followup&&daysFromToday(p.next_followup)<0],
    ['Hoy','flame',p=>p.next_followup&&daysFromToday(p.next_followup)===0],
    ['Próximos 7 días','calendar-days',p=>{const d=daysFromToday(p.next_followup);return p.next_followup&&d>0&&d<=7}],
    ['Más adelante','calendar-range',p=>p.next_followup&&daysFromToday(p.next_followup)>7]
  ];
  $('followupGroups').innerHTML=groups.map(g=>{
    const items=data.prospects.filter(p=>activeProspect(p)&&g[2](p)).sort((a,b)=>a.next_followup.localeCompare(b.next_followup));
    return '<article class="followup-card"><div class="panel-head"><div><span class="eyebrow">'+g[0].toUpperCase()+'</span><h3>'+g[0]+' · '+items.length+'</h3></div><i data-lucide="'+g[1]+'"></i></div><div class="action-list">'+(items.length?items.map(p=>'<button class="action-item" data-open="'+p.id+'"><span class="item-title"><span class="mini-icon"><i data-lucide="building-2"></i></span><span><b>'+esc(p.business_name)+'</b><small>'+esc(p.next_action||p.status)+' · '+esc(ownerShort(p.owner_id))+'</small></span></span><span class="date-pill status-blue">'+fmtDate(p.next_followup)+'</span></button>').join(''):emptyState('Sin seguimientos.','calendar-check'))+'</div></article>';
  }).join('');
}
function renderTasks(){
  const groups=[
    ['Pendientes','pendiente'],
    ['En progreso','en_progreso'],
    ['Completadas','completada']
  ];
  $('taskBoard').innerHTML=groups.map(([label,status])=>{
    const tasks=data.tasks.filter(t=>t.status===status).sort((a,b)=>(a.due_at||'9999').localeCompare(b.due_at||'9999'));
    return '<section class="task-col"><h3>'+label+' · '+tasks.length+'</h3>'+(tasks.length?tasks.map(t=>{
      const p=data.prospects.find(x=>x.id===t.prospect_id);
      return '<article class="task-card" data-task="'+t.id+'"><b>'+esc(t.title)+'</b><p>'+esc(t.description||p?.business_name||'')+'</p><div class="task-meta"><span class="priority-pill '+(t.priority==='urgente'||t.priority==='alta'?'status-red':'status-gray')+'">'+esc(t.priority)+'</span><span>'+fmtDateTime(t.due_at)+'</span></div>'+(canWrite()?'<div class="row-actions" style="margin-top:8px"><button class="mini-btn" data-task-toggle="'+t.id+'">'+(status==='completada'?'Reabrir':'Completar')+'</button></div>':'')+'</article>';
    }).join(''):emptyState('Sin tareas.','check-check'))+'</section>';
  }).join('');
}
function renderClients(){
  const rows=data.clients.slice().sort((a,b)=>a.business_name.localeCompare(b.business_name));
  $('clientRows').innerHTML=rows.length?rows.map(client=>
    '<tr><td><span class="row-main"><b>'+esc(client.business_name)+'</b><small>'+esc(client.tax_identifier||'Sin identificación fiscal')+'</small></span></td>'+
    '<td>'+esc(client.contact_name||'—')+'<small class="cell-sub">'+esc(client.email||client.phone||'Sin datos')+'</small></td>'+
    '<td>'+esc(client.city||'—')+'</td><td>'+businessPill(client.status,{active:'Activo',inactive:'Inactivo'})+'</td>'+
    '<td>'+fmtDate(client.updated_at||client.created_at)+'</td></tr>'
  ).join(''):'<tr><td colspan="5">'+emptyState('Todavía no hay clientes registrados.','building-2')+'</td></tr>';
  $('mobileClients').innerHTML=rows.length?rows.map(client=>
    '<article class="mobile-card"><div class="mobile-card-top"><b>'+esc(client.business_name)+'</b>'+businessPill(client.status,{active:'Activo',inactive:'Inactivo'})+'</div><p>'+esc(client.contact_name||'Sin contacto')+' · '+esc(client.city||'Sin localidad')+'</p><small>'+esc(client.email||client.phone||'Sin datos de contacto')+'</small></article>'
  ).join(''):emptyState('Todavía no hay clientes registrados.','building-2');
}
function renderProjects(){
  const rows=data.projects.slice().sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  $('projectGrid').innerHTML=rows.length?rows.map(project=>{
    const client=clientById(project.client_id);
    const progress=Math.max(0,Math.min(100,Number(project.progress)||0));
    return '<article class="project-card"><div class="project-card-head"><span class="mini-icon"><i data-lucide="briefcase-business"></i></span>'+businessPill(project.status,PROJECT_STATUS_LABELS)+'</div>'+
      '<h3>'+esc(project.name)+'</h3><p>'+esc(project.description||'Sin descripción')+'</p>'+
      '<div class="project-meta"><span><i data-lucide="building-2"></i>'+esc(client?.business_name||'Proyecto interno')+'</span><span><i data-lucide="user-round"></i>'+esc(ownerName(project.owner_id))+'</span><span><i data-lucide="calendar"></i>'+fmtDate(project.due_date)+'</span></div>'+
      '<div class="progress-copy"><span>Avance</span><b>'+progress+'%</b></div><div class="progress-track"><i style="width:'+progress+'%"></i></div>'+
      (canWrite()?'<button class="mini-btn project-progress-btn" data-project-progress="'+project.id+'"><i data-lucide="gauge"></i>Actualizar avance</button>':'')+'</article>';
  }).join(''):emptyState('Todavía no hay proyectos para esta empresa.','briefcase-business');
}
function renderDocuments(){
  const rows=data.documents.slice().sort((a,b)=>(b.updated_at||b.created_at||'').localeCompare(a.updated_at||a.created_at||''));
  $('documentRows').innerHTML=rows.length?rows.map(document=>{
    const project=projectById(document.project_id);
    return '<tr><td><span class="row-main"><b>'+esc(document.title)+'</b><small>'+esc(document.mime_type||'Documento interno')+'</small></span></td>'+
      '<td>'+esc(DOCUMENT_CATEGORY_LABELS[document.category]||labelFrom(document.category))+'</td><td>'+esc(project?.name||'—')+'</td>'+
      '<td>'+businessPill(document.status,DOCUMENT_STATUS_LABELS)+'</td><td>'+fmtDate(document.expires_at)+'</td>'+
      '<td>'+(document.storage_path?'<button class="mini-btn" data-document-open="'+document.id+'"><i data-lucide="external-link"></i>Ver</button>':'<span class="cell-sub">Sin archivo</span>')+'</td></tr>';
  }).join(''):'<tr><td colspan="6">'+emptyState('Todavía no hay documentos privados.','files')+'</td></tr>';
  $('mobileDocuments').innerHTML=rows.length?rows.map(document=>
    '<article class="mobile-card"><div class="mobile-card-top"><b>'+esc(document.title)+'</b>'+businessPill(document.status,DOCUMENT_STATUS_LABELS)+'</div><p>'+esc(DOCUMENT_CATEGORY_LABELS[document.category]||labelFrom(document.category))+' · '+esc(projectById(document.project_id)?.name||'Sin proyecto')+'</p>'+(document.storage_path?'<button class="mini-btn" data-document-open="'+document.id+'">Abrir archivo</button>':'<small>Sin archivo asociado</small>')+'</article>'
  ).join(''):emptyState('Todavía no hay documentos privados.','files');
}
function totalsByCurrency(rows,field='total'){
  return rows.reduce((totals,row)=>{
    const currency=row.currency||'ARS';
    totals[currency]=(totals[currency]||0)+Number(row[field]||0);
    return totals;
  },{});
}
function formatCurrencyTotals(totals){
  const entries=Object.entries(totals);
  return entries.length?entries.map(([currency,total])=>money(total,currency)).join(' + '):money(0,activeOrganization?.default_currency||'ARS');
}
function renderBilling(){
  if(!canManageFinance())return;
  const issued=data.invoices.filter(invoice=>!['draft','cancelled'].includes(invoice.status));
  const pending=data.invoices.filter(invoice=>['issued','partially_paid','overdue'].includes(invoice.status));
  const paid=data.payments;
  const metrics=[
    ['Emitido',formatCurrencyTotals(totalsByCurrency(issued)),'receipt-text','Documentos internos'],
    ['Pendiente',formatCurrencyTotals(totalsByCurrency(pending)),'clock-3','Por cobrar'],
    ['Cobrado',formatCurrencyTotals(totalsByCurrency(paid,'amount')),'circle-dollar-sign','Pagos registrados']
  ];
  $('billingKpis').innerHTML=metrics.map(metric=>'<article class="kpi"><div class="kpi-top"><span class="kpi-label">'+metric[0]+'</span><span class="kpi-icon"><i data-lucide="'+metric[2]+'"></i></span></div><strong class="money-kpi">'+esc(metric[1])+'</strong><small>'+metric[3]+'</small></article>').join('');
  const rows=data.invoices.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  $('invoiceRows').innerHTML=rows.length?rows.map(invoice=>{
    const balance=Math.max(0,Number(invoice.total||0)-data.payments.filter(payment=>payment.invoice_id===invoice.id).reduce((sum,payment)=>sum+Number(payment.amount||0),0));
    return '<tr><td><span class="row-main"><b>'+esc(invoice.internal_number)+'</b><small>'+esc(invoice.is_fiscal?'Fiscal':'Interno no fiscal')+'</small></span></td>'+
      '<td>'+esc(clientById(invoice.client_id)?.business_name||'—')+'</td><td>'+esc(labelFrom(invoice.document_type))+'</td><td>'+money(invoice.total,invoice.currency)+'</td>'+
      '<td>'+businessPill(invoice.status,INVOICE_STATUS_LABELS)+'</td><td>'+fmtDate(invoice.due_date)+'</td><td>'+
      (balance>0&&!['draft','cancelled'].includes(invoice.status)?'<button class="mini-btn" data-payment="'+invoice.id+'">Registrar pago</button>':'')+'</td></tr>';
  }).join(''):'<tr><td colspan="7">'+emptyState('Todavía no hay comprobantes internos.','receipt-text')+'</td></tr>';
  $('mobileInvoices').innerHTML=rows.length?rows.map(invoice=>
    '<article class="mobile-card"><div class="mobile-card-top"><b>'+esc(invoice.internal_number)+'</b>'+businessPill(invoice.status,INVOICE_STATUS_LABELS)+'</div><p>'+esc(clientById(invoice.client_id)?.business_name||'Sin cliente')+' · '+money(invoice.total,invoice.currency)+'</p>'+(!['draft','cancelled','paid'].includes(invoice.status)?'<button class="mini-btn" data-payment="'+invoice.id+'">Registrar pago</button>':'')+'</article>'
  ).join(''):emptyState('Todavía no hay comprobantes internos.','receipt-text');
}
function renderTeam(){
  const rows=data.organizationMemberships.map(membership=>({membership,profile:profileById(membership.user_id)}));
  $('teamGrid').innerHTML=rows.length?rows.map(({membership,profile})=>
    '<article class="team-card"><span class="avatar team-avatar">'+initials(profile?.full_name||'Usuario')+'</span><div><h3>'+esc(profile?.full_name||'Usuario')+'</h3><p>'+esc(profile?.username||'Sin usuario')+'</p><span class="role-chip">'+esc(roleLabel(membership.role))+'</span></div><span class="status-pill '+(membership.active?'status-green':'status-red')+'">'+(membership.active?'Activo':'Inactivo')+'</span></article>'
  ).join(''):emptyState('No hay miembros activos en esta empresa.','users');
}
function renderReports(){
  charts.forEach(c=>c.destroy());charts=[];
  const p=data.prospects,total=p.length||1,rep=p.filter(isReply).length,opp=p.filter(isOpportunity).length,clients=p.filter(x=>x.status==='Cliente').length;
  const metrics=[
    ['Tasa de respuesta',Math.round(rep/total*100)+'%','message-circle-reply',rep+' de '+p.length],
    ['Oportunidades',Math.round(opp/total*100)+'%','sparkles',opp+' prospectos'],
    ['Clientes',clients,'badge-check','Cierres comerciales'],
    ['Interacciones',data.interactions.length,'activity','Historial total'],
    ['Seguimientos vencidos',p.filter(x=>x.next_followup&&daysFromToday(x.next_followup)<0&&activeProspect(x)).length,'triangle-alert','Requieren acción']
  ];
  $('reportKpis').innerHTML=metrics.map(k=>'<article class="kpi"><div class="kpi-top"><span class="kpi-label">'+k[0]+'</span><span class="kpi-icon"><i data-lucide="'+k[2]+'"></i></span></div><strong>'+k[1]+'</strong><small>'+k[3]+'</small></article>').join('');

  const sectors=[...new Set(p.map(x=>x.sector||'Sin rubro'))].sort();
  $('sectorReportRows').innerHTML=sectors.length?sectors.map(s=>{
    const a=p.filter(x=>(x.sector||'Sin rubro')===s),r=a.filter(isReply).length,o=a.filter(isOpportunity).length,c=a.filter(x=>x.status==='Cliente').length;
    return '<tr><td>'+esc(s)+'</td><td>'+a.length+'</td><td>'+r+'</td><td>'+o+'</td><td>'+c+'</td><td>'+(a.length?Math.round(o/a.length*100):0)+'%</td></tr>';
  }).join(''):'<tr><td colspan="6">Sin datos.</td></tr>';

  const statusCounts=STATUSES.map(s=>p.filter(x=>x.status===s).length);
  const sc=getComputedStyle(document.documentElement).getPropertyValue('--sc-blue').trim()||'#0360BD';
  const cyan=getComputedStyle(document.documentElement).getPropertyValue('--sc-cyan').trim()||'#31A5D6';
  charts.push(new Chart($('pipelineChart'),{type:'bar',data:{labels:STATUSES,datasets:[{data:statusCounts,backgroundColor:sc,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:9},color:getComputedStyle(document.body).getPropertyValue('--muted')}},y:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(120,140,155,.12)'}}}}}));
  const sectorOpp=sectors.map(s=>p.filter(x=>(x.sector||'Sin rubro')===s&&isOpportunity(x)).length);
  charts.push(new Chart($('sectorChart'),{type:'doughnut',data:{labels:sectors,datasets:[{data:sectorOpp,backgroundColor:sectors.map((_,i)=>i%2?cyan:sc),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:9},color:getComputedStyle(document.body).getPropertyValue('--muted')}}}}}));
  lucideRefresh();
}

function resetProspectForm(){
  $('prospectForm').reset();$('prospectId').value='';$('city').value='Cdelu';$('brand').value='SC';$('status').value='Prospecto';$('owner').value=currentProfile?.id||'';$('prospectModalTitle').textContent='Nuevo prospecto';
}
function editProspect(id){
  const p=data.prospects.find(x=>x.id===id);if(!p)return;
  resetProspectForm();
  $('prospectId').value=p.id;$('businessName').value=p.business_name||'';$('sector').value=p.sector||'';$('city').value=p.city||'';$('contactName').value=p.contact_name||'';$('jobTitle').value=p.job_title||'';$('phone').value=p.phone||'';$('email').value=p.email||'';$('owner').value=p.owner_id||'';$('brand').value=p.brand||'SC';$('status').value=p.status||'Prospecto';$('nextAction').value=p.next_action||'';$('nextFollowup').value=p.next_followup||'';$('needInterest').value=p.need_interest||'';$('notes').value=p.notes||'';$('prospectModalTitle').textContent='Editar prospecto';openModal('prospectModal');
}
async function submitProspect(event){
  event.preventDefault();
  if(!ensureWriteAccess())return;
  const id=$('prospectId').value;
  const payload={
    organization_id:activeOrganizationId(),
    business_name:$('businessName').value.trim(),
    sector:$('sector').value.trim()||null,
    city:$('city').value.trim()||null,
    contact_name:$('contactName').value.trim()||null,
    job_title:$('jobTitle').value.trim()||null,
    phone:$('phone').value.trim()||null,
    email:$('email').value.trim()||null,
    owner_id:$('owner').value||null,
    brand:$('brand').value,
    status:$('status').value,
    next_action:$('nextAction').value.trim()||null,
    next_followup:$('nextFollowup').value||null,
    need_interest:$('needInterest').value.trim()||null,
    notes:$('notes').value.trim()||null
  };
  if(mode==='supabase'){
    let res;
    if(id) res=await supabase.from('prospects').update(payload).eq('id',id).eq('organization_id',activeOrganizationId()).select().single();
    else res=await supabase.from('prospects').insert({...payload,created_by:currentProfile.id,source:'CRM'}).select().single();
    if(res.error){ notify('No se pudo guardar: '+res.error.message); return; }
    await loadRemoteData();
  }else{
    if(id){
      const i=data.prospects.findIndex(x=>x.id===id);data.prospects[i]={...data.prospects[i],...payload,updated_at:new Date().toISOString()};
    }else{
      const p={id:uuid(),...payload,created_by:currentProfile.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      data.prospects.unshift(p);
      data.interactions.unshift({id:uuid(),prospect_id:p.id,user_id:currentProfile.id,type:'Nota',result:'Prospecto creado en CRM',happened_at:new Date().toISOString(),created_at:new Date().toISOString()});
    }
    saveDemo();
  }
  closeModal('prospectModal');notify(id?'Prospecto actualizado':'Prospecto creado');
}

function openDetail(id){
  const p=data.prospects.find(x=>x.id===id);if(!p)return;
  $('detailTitle').textContent=p.business_name;
  $('detailSubtitle').textContent=(p.sector||'Sin rubro')+' · '+(p.city||'Sin localidad')+' · '+ownerName(p.owner_id);
  const phone=(p.phone||'').replace(/\D/g,'').replace(/^0+/,'');
  const wa=phone?'https://wa.me/'+(phone.startsWith('54')?phone:'54'+phone):'';
  const inter=data.interactions.filter(x=>x.prospect_id===id).sort((a,b)=>(b.happened_at||'').localeCompare(a.happened_at||''));
  const meetings=data.meetings.filter(x=>x.prospect_id===id).sort((a,b)=>(a.starts_at||'').localeCompare(b.starts_at||''));
  const tasks=data.tasks.filter(x=>x.prospect_id===id && x.status!=='cancelada').sort((a,b)=>(a.due_at||'9999').localeCompare(b.due_at||'9999'));
  const proposals=data.proposals.filter(x=>x.prospect_id===id).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));

  const fields=[
    ['Estado',p.status],['Responsable',ownerName(p.owner_id)],['Contacto',p.contact_name||'—'],['Cargo',p.job_title||'—'],
    ['Teléfono',p.phone||'—'],['Email',p.email||'—'],['Próxima acción',p.next_action||'—'],['Seguimiento',fmtDate(p.next_followup)]
  ];
  $('detailBody').innerHTML=
    '<div class="quick-actions">'+
      (wa?'<a class="btn btn-primary" target="_blank" rel="noopener" href="'+wa+'" style="text-decoration:none"><i data-lucide="message-circle"></i>WhatsApp</a>':'')+
      (canWrite()?'<button class="btn btn-secondary" data-action="interaction" data-prospect="'+id+'"><i data-lucide="history"></i>Interacción</button>'+
      '<button class="btn btn-secondary" data-action="meeting" data-prospect="'+id+'"><i data-lucide="calendar-plus"></i>Reunión</button>'+
      '<button class="btn btn-secondary" data-action="task" data-prospect="'+id+'"><i data-lucide="list-plus"></i>Tarea</button>'+
      '<button class="btn btn-secondary" data-action="proposal" data-prospect="'+id+'"><i data-lucide="file-plus-2"></i>Propuesta</button>'+
      '<button class="btn btn-secondary" data-edit="'+id+'"><i data-lucide="pencil"></i>Editar</button>':'')+
    '</div>'+
    '<div class="detail-layout">'+
      '<div>'+
        '<div class="detail-card" style="margin-bottom:12px"><h3>Información comercial</h3><div class="detail-grid">'+fields.map(([k,v])=>'<div class="detail-field"><span>'+k+'</span><b>'+esc(v)+'</b></div>').join('')+'</div></div>'+
        '<div class="detail-card" style="margin-bottom:12px"><h3>Necesidad / interés</h3><p style="font-size:11px;line-height:1.6;color:var(--muted);margin:0">'+esc(p.need_interest||'Sin información')+'</p></div>'+
        '<div class="detail-card"><h3>Historial</h3><div class="timeline">'+(inter.length?inter.map(i=>'<div class="timeline-item"><b>'+fmtDateTime(i.happened_at)+' · '+esc(i.type)+'</b><p>'+esc(i.result||i.notes||'Interacción registrada')+(i.next_step?' · Próximo: '+esc(i.next_step):'')+'</p></div>').join(''):emptyState('Sin interacciones.','history'))+'</div></div>'+
      '</div>'+
      '<div>'+
        '<div class="detail-card" style="margin-bottom:12px"><h3>Reuniones</h3>'+(meetings.length?meetings.map(m=>'<div class="action-item"><span class="item-title"><span class="mini-icon"><i data-lucide="calendar"></i></span><span><b>'+fmtDateTime(m.starts_at)+'</b><small>'+esc(m.modality)+' · '+esc(m.status)+'</small></span></span></div>').join(''):emptyState('Sin reuniones.','calendar'))+'</div>'+
        '<div class="detail-card" style="margin-bottom:12px"><h3>Tareas</h3>'+(tasks.length?tasks.slice(0,5).map(t=>'<div class="action-item"><span><b style="font-size:10px">'+esc(t.title)+'</b><small style="display:block;color:var(--muted);font-size:9px">'+esc(t.status)+' · '+fmtDateTime(t.due_at)+'</small></span></div>').join(''):emptyState('Sin tareas.','list-checks'))+'</div>'+
        '<div class="detail-card"><h3>Propuestas</h3>'+(proposals.length?proposals.map(x=>'<div class="action-item"><span><b style="font-size:10px">'+esc(x.title)+'</b><small style="display:block;color:var(--muted);font-size:9px">'+esc(x.status)+' · '+money(x.amount,x.currency)+'</small></span></div>').join(''):emptyState('Sin propuestas.','file-text'))+'</div>'+
      '</div>'+
    '</div>';
  openModal('detailModal');lucideRefresh();
}
function money(amount,currency='ARS'){
  if(amount==null||amount==='') return 'Sin monto';
  try{return new Intl.NumberFormat('es-AR',{style:'currency',currency}).format(amount)}catch{return currency+' '+amount}
}

function openAction(type,prospectId=null){
  if(['invoice','payment'].includes(type)&&!ensureWriteAccess(true))return;
  if(!['invoice','payment','changePassword'].includes(type)&&!ensureWriteAccess())return;
  const p=prospectId?data.prospects.find(x=>x.id===prospectId):null;
  const titles={
    interaction:'Registrar interacción',meeting:'Programar reunión',task:'Nueva tarea',proposal:'Nueva propuesta',
    client:'Nuevo cliente',project:'Nuevo proyecto',projectProgress:'Actualizar proyecto',document:'Subir documento',
    invoice:'Nuevo comprobante interno',payment:'Registrar pago',changePassword:'Cambiar contraseña'
  };
  $('actionTitle').textContent=titles[type]||'Acción';
  $('actionEyebrow').textContent=p?esc(p.business_name).toUpperCase():'SC CRM';

  if(type==='interaction'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Prospecto<select name="prospect_id" '+(p?'disabled':'')+'>'+prospectSelect(prospectId)+'</select></label><label>Tipo<select name="type">'+INTERACTION_TYPES.map(t=>'<option>'+t+'</option>').join('')+'</select></label><label>Resultado / nota<textarea name="result" rows="3" required></textarea></label><label>Fecha y hora<input name="happened_at" type="datetime-local" value="'+dayjs().format('YYYY-MM-DDTHH:mm')+'" required></label><label>Próximo paso<input name="next_step"></label><label>Próxima fecha<input name="next_date" type="date"></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Registrar</button></div></form>';
    $('actionForm').onsubmit=e=>submitInteraction(e,prospectId);
  }
  if(type==='meeting'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Prospecto<select name="prospect_id" '+(p?'disabled':'')+'>'+prospectSelect(prospectId)+'</select></label><label>Fecha y hora<input name="starts_at" type="datetime-local" required></label><label>Duración (min)<input name="duration_minutes" type="number" min="10" max="480" value="30"></label><label>Modalidad<select name="modality"><option>Presencial</option><option>Videollamada</option><option>Llamada</option></select></label><label>Lugar / enlace<input name="location"></label><label>Objetivo<textarea name="agenda" rows="3"></textarea></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Programar</button></div></form>';
    $('actionForm').onsubmit=e=>submitMeeting(e,prospectId);
  }
  if(type==='task'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Prospecto<select name="prospect_id"><option value="">Sin prospecto</option>'+prospectSelect(prospectId,true)+'</select></label><label>Título<input name="title" required></label><label>Descripción<textarea name="description" rows="3"></textarea></label><label>Asignar a<select name="assigned_to">'+ownerOptions(currentProfile?.id)+'</select></label><label>Prioridad<select name="priority"><option>baja</option><option selected>media</option><option>alta</option><option>urgente</option></select></label><label>Vencimiento<input name="due_at" type="datetime-local"></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Crear tarea</button></div></form>';
    if(prospectId) $('actionForm').elements.prospect_id.value=prospectId;
    $('actionForm').onsubmit=e=>submitTask(e);
  }
  if(type==='proposal'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Prospecto<select name="prospect_id" '+(p?'disabled':'')+'>'+prospectSelect(prospectId)+'</select></label><label>Título<input name="title" required></label><label>Monto<input name="amount" type="number" min="0" step="0.01"></label><label>Moneda<select name="currency"><option>ARS</option><option>USD</option></select></label><label>Estado<select name="status"><option>borrador</option><option>enviada</option></select></label><label>Válida hasta<input name="valid_until" type="date"></label><label>Notas<textarea name="notes" rows="3"></textarea></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Guardar propuesta</button></div></form>';
    $('actionForm').onsubmit=e=>submitProposal(e,prospectId);
  }
  if(type==='client'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Razón comercial / nombre<input name="business_name" required maxlength="160"></label><label>CUIT o identificación opcional<input name="tax_identifier" maxlength="40"></label><label>Persona de contacto<input name="contact_name" maxlength="120"></label><label>Email<input name="email" type="email" maxlength="180"></label><label>Teléfono<input name="phone" inputmode="tel" maxlength="40"></label><label>Localidad<input name="city" maxlength="100"></label><label>Dirección<input name="address" maxlength="220"></label><label>Estado<select name="status"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label><label>Notas<textarea name="notes" rows="3" maxlength="2000"></textarea></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Guardar cliente</button></div></form>';
    $('actionForm').onsubmit=submitClient;
  }
  if(type==='project'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Proyecto<input name="name" required maxlength="180"></label><label>Cliente<select name="client_id"><option value="">Proyecto interno</option>'+clientOptions()+'</select></label><label>Descripción<textarea name="description" rows="3" maxlength="3000"></textarea></label><label>Responsable<select name="owner_id"><option value="">Sin asignar</option>'+ownerOptions(currentProfile?.id)+'</select></label><label>Estado<select name="status"><option value="planned">Planificado</option><option value="in_progress">En curso</option><option value="waiting">En espera</option><option value="review">En revisión</option><option value="completed">Completado</option></select></label><label>Prioridad<select name="priority"><option value="low">Baja</option><option value="medium" selected>Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Inicio<input name="start_date" type="date" value="'+isoDate()+'"></label><label>Fecha objetivo<input name="due_date" type="date"></label><label>Presupuesto estimado<input name="budget" type="number" min="0" step="0.01"></label><label>Moneda<select name="currency"><option>ARS</option><option>USD</option></select></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Crear proyecto</button></div></form>';
    $('actionForm').onsubmit=submitProject;
  }
  if(type==='projectProgress'){
    const project=projectById(prospectId);
    if(!project)return;
    $('actionEyebrow').textContent=project.name.toUpperCase();
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Estado<select name="status">'+Object.entries(PROJECT_STATUS_LABELS).map(([value,label])=>'<option value="'+value+'" '+(project.status===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Avance (%)<input name="progress" type="number" min="0" max="100" value="'+Number(project.progress||0)+'" required></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Actualizar</button></div></form>';
    $('actionForm').onsubmit=e=>submitProjectProgress(e,project.id);
  }
  if(type==='document'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Título<input name="title" required maxlength="180"></label><label>Categoría<select name="category">'+Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select></label><label>Cliente<select name="client_id"><option value="">Sin cliente</option>'+clientOptions()+'</select></label><label>Proyecto<select name="project_id"><option value="">Sin proyecto</option>'+projectOptions()+'</select></label><label>Estado<select name="status"><option value="draft">Borrador</option><option value="pending_review">En revisión</option><option value="approved">Aprobado</option></select></label><label>Vencimiento<input name="expires_at" type="date"></label><label class="file-label">Archivo<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv" '+(mode==='supabase'?'required':'')+'><small>PDF, PNG, JPG, WebP o CSV. Máximo 15 MB.</small></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Guardar documento</button></div></form>';
    $('actionForm').onsubmit=submitDocument;
  }
  if(type==='invoice'){
    const number='INT-'+dayjs().format('YYYYMM')+'-'+String(data.invoices.length+1).padStart(4,'0');
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Número interno<input name="internal_number" value="'+number+'" required maxlength="60"></label><label>Cliente<select name="client_id" required><option value="">Seleccionar</option>'+clientOptions()+'</select></label><label>Proyecto<select name="project_id"><option value="">Sin proyecto</option>'+projectOptions()+'</select></label><label>Tipo<select name="document_type"><option value="quote">Presupuesto</option><option value="invoice">Comprobante</option><option value="receipt">Recibo</option><option value="credit_note">Nota de crédito</option><option value="debit_note">Nota de débito</option></select></label><label>Descripción<textarea name="description" rows="3" maxlength="2000"></textarea></label><label>Importe total<input name="total" type="number" min="0" step="0.01" required></label><label>Moneda<select name="currency"><option>ARS</option><option>USD</option></select></label><label>Estado<select name="status"><option value="draft">Borrador</option><option value="pending_approval">Pendiente de aprobación</option><option value="issued">Emitido</option></select></label><label>Fecha de emisión<input name="issue_date" type="date" value="'+isoDate()+'"></label><label>Vencimiento<input name="due_date" type="date"></label><label>Notas<textarea name="notes" rows="2" maxlength="2000"></textarea></label><p class="form-hint">Documento interno no fiscal. No reemplaza comprobantes emitidos ante ARCA.</p><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Guardar comprobante</button></div></form>';
    $('actionForm').onsubmit=submitInvoice;
  }
  if(type==='payment'){
    const invoice=invoiceById(prospectId);
    if(!invoice)return;
    const paid=data.payments.filter(payment=>payment.invoice_id===invoice.id).reduce((sum,payment)=>sum+Number(payment.amount||0),0);
    const balance=Math.max(0,Number(invoice.total||0)-paid);
    $('actionEyebrow').textContent=invoice.internal_number;
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><div class="payment-summary"><span>Saldo pendiente</span><strong>'+money(balance,invoice.currency)+'</strong></div><label>Importe<input name="amount" type="number" min="0.01" max="'+balance+'" step="0.01" value="'+balance+'" required></label><label>Medio<select name="method"><option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></label><label>Referencia<input name="reference" maxlength="120"></label><label>Fecha y hora<input name="paid_at" type="datetime-local" value="'+dayjs().format('YYYY-MM-DDTHH:mm')+'" required></label><label>Notas<textarea name="notes" rows="2" maxlength="1000"></textarea></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Registrar pago</button></div></form>';
    $('actionForm').onsubmit=e=>submitPayment(e,invoice.id);
  }
  if(type==='changePassword'){
    $('actionBody').innerHTML='<form class="action-form" id="actionForm"><label>Nueva contraseña<input name="password" type="password" minlength="8" required></label><label>Repetir contraseña<input name="password2" type="password" minlength="8" required></label><p style="font-size:10px;color:var(--muted);line-height:1.55">Usá una contraseña distinta al nombre de usuario para mejorar la seguridad del acceso.</p><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary">Cambiar contraseña</button></div></form>';
    $('actionForm').onsubmit=submitPassword;
  }
  $('actionBody').querySelectorAll('form button:not([type])').forEach(button=>button.type='submit');
  openModal('actionModal');lucideRefresh();
}
function prospectSelect(selected='',includeBlank=false){
  return (includeBlank?'':'')+data.prospects.filter(activeProspect).sort((a,b)=>a.business_name.localeCompare(b.business_name)).map(x=>'<option value="'+x.id+'" '+(x.id===selected?'selected':'')+'>'+esc(x.business_name)+'</option>').join('');
}
function clientOptions(selected=''){
  return data.clients.filter(client=>client.status!=='inactive').map(client=>'<option value="'+client.id+'" '+(client.id===selected?'selected':'')+'>'+esc(client.business_name)+'</option>').join('');
}
function projectOptions(selected=''){
  return data.projects.filter(project=>!['completed','cancelled'].includes(project.status)).map(project=>'<option value="'+project.id+'" '+(project.id===selected?'selected':'')+'>'+esc(project.name)+'</option>').join('');
}
function ensureWriteAccess(finance=false){
  const allowed=finance?canManageFinance():canWrite();
  if(!allowed)notify('Tu rol tiene acceso de solo lectura.');
  return allowed;
}
async function submitClient(e){
  e.preventDefault();
  if(!ensureWriteAccess())return;
  const f=new FormData(e.target);
  const payload={
    organization_id:activeOrganizationId(),business_name:f.get('business_name').trim(),
    tax_identifier:f.get('tax_identifier').trim()||null,contact_name:f.get('contact_name').trim()||null,
    email:f.get('email').trim()||null,phone:f.get('phone').trim()||null,address:f.get('address').trim()||null,
    city:f.get('city').trim()||null,status:f.get('status'),notes:f.get('notes').trim()||null,created_by:currentProfile.id
  };
  if(mode==='supabase'){
    const {error}=await supabase.from('clients').insert(payload);
    if(error){notify('No se pudo guardar: '+error.message);return}
    await loadRemoteData();
  }else{
    data.clients.unshift({id:uuid(),...payload,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});saveDemo();
  }
  closeModal('actionModal');notify('Cliente guardado');
}
async function submitProject(e){
  e.preventDefault();
  if(!ensureWriteAccess())return;
  const f=new FormData(e.target);
  const payload={
    organization_id:activeOrganizationId(),client_id:f.get('client_id')||null,name:f.get('name').trim(),
    description:f.get('description').trim()||null,status:f.get('status'),priority:f.get('priority'),
    owner_id:f.get('owner_id')||null,start_date:f.get('start_date')||null,due_date:f.get('due_date')||null,
    budget:f.get('budget')?Number(f.get('budget')):null,currency:f.get('currency'),progress:0,created_by:currentProfile.id
  };
  if(mode==='supabase'){
    const {error}=await supabase.from('projects').insert(payload);
    if(error){notify('No se pudo guardar: '+error.message);return}
    await loadRemoteData();
  }else{
    data.projects.unshift({id:uuid(),...payload,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});saveDemo();
  }
  closeModal('actionModal');notify('Proyecto creado');
}
async function submitProjectProgress(e,projectId){
  e.preventDefault();
  if(!ensureWriteAccess())return;
  const f=new FormData(e.target),progress=Math.max(0,Math.min(100,Number(f.get('progress'))));
  const status=progress===100?'completed':f.get('status');
  const patch={status,progress};
  if(mode==='supabase'){
    const {error}=await supabase.from('projects').update(patch).eq('id',projectId).eq('organization_id',activeOrganizationId());
    if(error){notify('No se pudo actualizar: '+error.message);return}
    await loadRemoteData();
  }else{
    Object.assign(projectById(projectId),patch,{updated_at:new Date().toISOString()});saveDemo();
  }
  closeModal('actionModal');notify('Avance actualizado');
}
function safeFileName(name='documento'){
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120)||'documento';
}
async function submitDocument(e){
  e.preventDefault();
  if(!ensureWriteAccess())return;
  const f=new FormData(e.target),file=f.get('file');
  if(file?.size>15728640){notify('El archivo supera el máximo de 15 MB.');return}
  let storagePath=null;
  if(mode==='supabase'&&file?.size){
    storagePath=activeOrganizationId()+'/'+uuid()+'-'+safeFileName(file.name);
    const upload=await supabase.storage.from('organization-documents').upload(storagePath,file,{contentType:file.type,upsert:false});
    if(upload.error){notify('No se pudo subir: '+upload.error.message);return}
  }
  const payload={
    organization_id:activeOrganizationId(),client_id:f.get('client_id')||null,project_id:f.get('project_id')||null,
    title:f.get('title').trim(),category:f.get('category'),status:f.get('status'),storage_path:storagePath,
    mime_type:file?.size?file.type||null:null,size_bytes:file?.size||null,expires_at:f.get('expires_at')||null,created_by:currentProfile.id
  };
  if(mode==='supabase'){
    const {error}=await supabase.from('documents').insert(payload);
    if(error){
      if(storagePath)await supabase.storage.from('organization-documents').remove([storagePath]);
      notify('No se pudo registrar: '+error.message);return;
    }
    await loadRemoteData();
  }else{
    data.documents.unshift({id:uuid(),...payload,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});saveDemo();
  }
  closeModal('actionModal');notify('Documento guardado');
}
async function openDocument(documentId){
  const document=data.documents.find(item=>item.id===documentId);
  if(!document?.storage_path){notify('Este registro no tiene un archivo asociado.');return}
  if(mode!=='supabase'){notify('Archivo simulado: disponible al conectar Supabase.');return}
  const {data:signed,error}=await supabase.storage.from('organization-documents').createSignedUrl(document.storage_path,300);
  if(error||!signed?.signedUrl){notify('No se pudo abrir el archivo.');return}
  window.open(signed.signedUrl,'_blank','noopener,noreferrer');
}
async function submitInvoice(e){
  e.preventDefault();
  if(!ensureWriteAccess(true))return;
  const f=new FormData(e.target),total=Number(f.get('total')||0);
  const payload={
    organization_id:activeOrganizationId(),client_id:f.get('client_id')||null,project_id:f.get('project_id')||null,
    document_type:f.get('document_type'),internal_number:f.get('internal_number').trim(),description:f.get('description').trim()||null,
    currency:f.get('currency'),subtotal:total,tax_amount:0,total,status:f.get('status'),issue_date:f.get('issue_date')||null,
    due_date:f.get('due_date')||null,is_fiscal:false,notes:f.get('notes').trim()||null,created_by:currentProfile.id
  };
  if(mode==='supabase'){
    const {error}=await supabase.from('invoices').insert(payload);
    if(error){notify('No se pudo guardar: '+error.message);return}
    await loadRemoteData();
  }else{
    data.invoices.unshift({id:uuid(),...payload,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});saveDemo();
  }
  closeModal('actionModal');notify('Comprobante interno guardado');
}
async function submitPayment(e,invoiceId){
  e.preventDefault();
  if(!ensureWriteAccess(true))return;
  const invoice=invoiceById(invoiceId),f=new FormData(e.target),amount=Number(f.get('amount')||0);
  const payload={
    organization_id:activeOrganizationId(),invoice_id:invoiceId,amount,currency:invoice.currency,
    paid_at:new Date(f.get('paid_at')).toISOString(),method:f.get('method'),reference:f.get('reference').trim()||null,
    notes:f.get('notes').trim()||null,created_by:currentProfile.id
  };
  if(mode==='supabase'){
    const {error}=await supabase.from('payments').insert(payload);
    if(error){notify('No se pudo registrar: '+error.message);return}
    const result=await supabase.from('payments').select('amount').eq('organization_id',activeOrganizationId()).eq('invoice_id',invoiceId);
    const paid=(result.data||[]).reduce((sum,payment)=>sum+Number(payment.amount||0),0);
    await supabase.from('invoices').update({status:paid>=Number(invoice.total)?'paid':'partially_paid'}).eq('id',invoiceId).eq('organization_id',activeOrganizationId());
    await loadRemoteData();
  }else{
    data.payments.unshift({id:uuid(),...payload,created_at:new Date().toISOString()});
    const paid=data.payments.filter(payment=>payment.invoice_id===invoiceId).reduce((sum,payment)=>sum+Number(payment.amount||0),0);
    invoice.status=paid>=Number(invoice.total)?'paid':'partially_paid';saveDemo();
  }
  closeModal('actionModal');notify('Pago registrado');
}
async function submitInteraction(e,fixedId){
  e.preventDefault();if(!ensureWriteAccess())return;const f=new FormData(e.target);const prospectId=fixedId||f.get('prospect_id');
  const payload={organization_id:activeOrganizationId(),prospect_id:prospectId,user_id:currentProfile.id,type:f.get('type'),result:f.get('result'),next_step:f.get('next_step')||null,next_date:f.get('next_date')||null,happened_at:new Date(f.get('happened_at')).toISOString()};
  if(mode==='supabase'){
    const {error}=await supabase.from('interactions').insert(payload);if(error){notify(error.message);return}
    if(payload.next_date) await supabase.from('prospects').update({next_followup:payload.next_date,next_action:payload.next_step||null}).eq('id',prospectId).eq('organization_id',activeOrganizationId());
    await loadRemoteData();
  }else{
    data.interactions.unshift({id:uuid(),...payload,created_at:new Date().toISOString()});
    if(payload.next_date){const p=data.prospects.find(x=>x.id===prospectId);p.next_followup=payload.next_date;p.next_action=payload.next_step}
    saveDemo();
  }
  closeModal('actionModal');closeModal('detailModal');notify('Interacción registrada');
}
async function submitMeeting(e,fixedId){
  e.preventDefault();if(!ensureWriteAccess())return;const f=new FormData(e.target);const prospectId=fixedId||f.get('prospect_id');
  const payload={organization_id:activeOrganizationId(),prospect_id:prospectId,owner_id:currentProfile.id,starts_at:new Date(f.get('starts_at')).toISOString(),duration_minutes:Number(f.get('duration_minutes')||30),modality:f.get('modality'),location:f.get('location')||null,agenda:f.get('agenda')||null,status:'programada'};
  if(mode==='supabase'){
    const {error}=await supabase.from('meetings').insert(payload);if(error){notify(error.message);return}
    await supabase.from('prospects').update({status:'Reunión pendiente',next_action:'Realizar reunión',next_followup:dayjs(payload.starts_at).format('YYYY-MM-DD')}).eq('id',prospectId).eq('organization_id',activeOrganizationId());
    await loadRemoteData();
  }else{
    data.meetings.push({id:uuid(),...payload,created_at:new Date().toISOString()});const p=data.prospects.find(x=>x.id===prospectId);p.status='Reunión pendiente';p.next_action='Realizar reunión';p.next_followup=dayjs(payload.starts_at).format('YYYY-MM-DD');saveDemo();
  }
  closeModal('actionModal');closeModal('detailModal');notify('Reunión programada');
}
async function submitTask(e){
  e.preventDefault();if(!ensureWriteAccess())return;const f=new FormData(e.target);
  const due=f.get('due_at');
  const payload={organization_id:activeOrganizationId(),prospect_id:f.get('prospect_id')||null,assigned_to:f.get('assigned_to')||null,created_by:currentProfile.id,title:f.get('title'),description:f.get('description')||null,priority:f.get('priority'),status:'pendiente',due_at:due?new Date(due).toISOString():null};
  if(mode==='supabase'){const {error}=await supabase.from('tasks').insert(payload);if(error){notify(error.message);return}await loadRemoteData()}
  else{data.tasks.unshift({id:uuid(),...payload,created_at:new Date().toISOString()});saveDemo()}
  closeModal('actionModal');notify('Tarea creada');
}
async function submitProposal(e,fixedId){
  e.preventDefault();if(!ensureWriteAccess())return;const f=new FormData(e.target);const prospectId=fixedId||f.get('prospect_id');
  const status=f.get('status');
  const payload={organization_id:activeOrganizationId(),prospect_id:prospectId,created_by:currentProfile.id,title:f.get('title'),amount:f.get('amount')?Number(f.get('amount')):null,currency:f.get('currency'),status,valid_until:f.get('valid_until')||null,notes:f.get('notes')||null,sent_at:status==='enviada'?new Date().toISOString():null};
  if(mode==='supabase'){
    const {error}=await supabase.from('proposals').insert(payload);if(error){notify(error.message);return}
    if(status==='enviada') await supabase.from('prospects').update({status:'Propuesta enviada',next_action:'Esperar respuesta'}).eq('id',prospectId).eq('organization_id',activeOrganizationId());
    await loadRemoteData();
  }else{
    data.proposals.unshift({id:uuid(),...payload,created_at:new Date().toISOString()});if(status==='enviada'){const p=data.prospects.find(x=>x.id===prospectId);p.status='Propuesta enviada';p.next_action='Esperar respuesta'}saveDemo();
  }
  closeModal('actionModal');closeModal('detailModal');notify('Propuesta guardada');
}
async function submitPassword(e){
  e.preventDefault();const f=new FormData(e.target),a=f.get('password'),b=f.get('password2');
  if(a!==b){notify('Las contraseñas no coinciden');return}
  if(mode!=='supabase'){notify('Disponible con Supabase conectado');return}
  const {error}=await supabase.auth.updateUser({password:a});
  if(error){notify(error.message);return}
  await supabase.from('profiles').update({must_change_password:false}).eq('id',currentProfile.id);
  closeModal('actionModal');notify('Contraseña actualizada');
}
async function updateProspectStatus(id,status){
  if(!ensureWriteAccess()){await loadRemoteData();return}
  if(mode==='supabase'){
    const {error}=await supabase.from('prospects').update({status}).eq('id',id).eq('organization_id',activeOrganizationId());if(error){notify(error.message);await loadRemoteData();return}
    await loadRemoteData();
  }else{const p=data.prospects.find(x=>x.id===id);if(p)p.status=status;saveDemo()}
  notify('Etapa actualizada');
}
async function toggleTask(id){
  if(!ensureWriteAccess())return;
  const t=data.tasks.find(x=>x.id===id);if(!t)return;
  const status=t.status==='completada'?'pendiente':'completada';
  const patch={status,completed_at:status==='completada'?new Date().toISOString():null};
  if(mode==='supabase'){const {error}=await supabase.from('tasks').update(patch).eq('id',id).eq('organization_id',activeOrganizationId());if(error){notify(error.message);return}await loadRemoteData()}
  else{Object.assign(t,patch);saveDemo()}
  notify(status==='completada'?'Tarea completada':'Tarea reabierta');
}

function exportBackup(){
  const clean={exported_at:new Date().toISOString(),organization:activeOrganization,profiles:data.profiles,memberships:data.organizationMemberships,prospects:data.prospects,interactions:data.interactions,tasks:data.tasks,meetings:data.meetings,proposals:data.proposals,clients:data.clients,projects:data.projects,documents:data.documents,invoices:data.invoices,payments:data.payments};
  const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='sc-gestion-'+(activeOrganization?.slug||'empresa')+'-'+isoDate()+'.json';a.click();URL.revokeObjectURL(a.href);
}
function globalSearch(){
  const v=$('globalSearch').value.trim();
  if(!v)return;
  $('prospectSearch').value=v;setView('prospects');renderProspects();$('globalSearch').value='';
}
function bindStaticEvents(){
  $('loginForm').addEventListener('submit',login);
  $('demoLoginBtn').addEventListener('click',enterDemo);
  $('logoutBtn').addEventListener('click',logout);
  $('exportBtn').addEventListener('click',exportBackup);
  $('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  $('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem(THEME_KEY,document.body.classList.contains('dark')?'dark':'light');if(activeView==='reports')renderReports()});
  $('organizationSelect').addEventListener('change',event=>switchOrganization(event.target.value));
  $('newProspectBtn').addEventListener('click',()=>{resetProspectForm();openModal('prospectModal')});
  $('quickInteractionBtn').addEventListener('click',()=>openAction('interaction'));
  $('newTaskBtn').addEventListener('click',()=>openAction('task'));
  $('newClientBtn').addEventListener('click',()=>openAction('client'));
  $('newProjectBtn').addEventListener('click',()=>openAction('project'));
  $('newDocumentBtn').addEventListener('click',()=>openAction('document'));
  $('newInvoiceBtn').addEventListener('click',()=>openAction('invoice'));
  $('userPill').addEventListener('click',()=>openAction('changePassword'));
  $('prospectForm').addEventListener('submit',submitProspect);
  $('prospectSearch').addEventListener('input',renderProspects);
  ['statusFilter','ownerFilter','sectorFilter'].forEach(id=>$(id).addEventListener('change',renderProspects));
  $('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter')globalSearch()});
  document.addEventListener('keydown',e=>{
    if(e.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('globalSearch').focus()}
    if(e.key==='Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(m=>m.hidden=true);
  });
  document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  document.querySelectorAll('[data-view-jump]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewJump)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.hidden=true}));
  document.body.addEventListener('click',async e=>{
    const open=e.target.closest('[data-open]'); if(open?.dataset.open) openDetail(open.dataset.open);
    const edit=e.target.closest('[data-edit]'); if(edit){closeModal('detailModal');editProspect(edit.dataset.edit)}
    const action=e.target.closest('[data-action]'); if(action) openAction(action.dataset.action,action.dataset.prospect||null);
    const task=e.target.closest('[data-task-toggle]'); if(task) toggleTask(task.dataset.taskToggle);
    const project=e.target.closest('[data-project-progress]');if(project)openAction('projectProgress',project.dataset.projectProgress);
    const documentButton=e.target.closest('[data-document-open]');if(documentButton)await openDocument(documentButton.dataset.documentOpen);
    const payment=e.target.closest('[data-payment]');if(payment)openAction('payment',payment.dataset.payment);
  });
}

init();
