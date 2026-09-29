import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/+esm';

const app=window.SC_APP;
const $=id=>document.getElementById(id);
const fallbackPermissions=[
  ['dashboard.view','General','Ver inicio'],['crm.view','Comercial','Ver oportunidades'],['crm.write','Comercial','Gestionar oportunidades'],
  ['clients.view','Clientes','Ver clientes'],['clients.write','Clientes','Gestionar clientes'],['projects.view','Proyectos','Ver proyectos'],
  ['projects.write','Proyectos','Gestionar proyectos'],['tasks.view','Trabajo','Ver tareas'],['tasks.write','Trabajo','Gestionar tareas'],
  ['tasks.comment','Trabajo','Comentar tareas'],['documents.view','Documentos','Ver documentos'],['documents.write','Documentos','Gestionar documentos'],
  ['billing.view','Administración','Ver administración'],['billing.write','Administración','Gestionar comprobantes'],['billing.approve','Administración','Aprobar comprobantes'],
  ['communications.send','Comunicaciones','Enviar comunicaciones'],['agents.run','IA','Ejecutar agentes'],['agents.manage','IA','Configurar agentes'],
  ['reports.view','Reportes','Ver reportes'],['team.manage','Configuración','Administrar equipo'],['organization.manage','Configuración','Administrar empresa'],['audit.view','Configuración','Ver auditoría']
].map(([code,module,label],position)=>({code,module,label,position}));
const requestedSettingsTab=new URLSearchParams(location.search).get('tab');
let settingsTab=['company','permissions','notifications','integrations'].includes(requestedSettingsTab)?requestedSettingsTab:'company';
let integrationState={openai:null,email:null};

const esc=value=>app.format.esc(value);
const icon=()=>window.lucide?.createIcons();
const profile=id=>app.data.profiles.find(item=>item.id===id);
const membership=id=>app.data.organizationMemberships.find(item=>item.user_id===id);
const client=id=>app.data.clients.find(item=>item.id===id);
const invoice=id=>app.data.invoices.find(item=>item.id===id);
const task=id=>app.data.tasks.find(item=>item.id===id);
const isAppVisible=()=>!$('appShell')?.hidden;
const permissionCatalog=()=>app.data.permissionCatalog.length?app.data.permissionCatalog:fallbackPermissions;

function showAction(title,eyebrow,html,{wide=false}={}){
  $('actionTitle').textContent=title;
  $('actionEyebrow').textContent=eyebrow;
  $('actionBody').innerHTML=html;
  $('actionModal').querySelector('.modal').classList.toggle('modal-workspace-wide',wide);
  app.openModal('actionModal');
  icon();
}

function closePopovers(except=null){
  ['quickCreateMenu','notificationPanel','userMenu'].forEach(id=>{
    if(id===except)return;
    const panel=$(id);if(panel)panel.hidden=true;
  });
  [['quickCreateBtn','quickCreateMenu'],['notificationBtn','notificationPanel'],['userPill','userMenu']].forEach(([button,panel])=>{
    if(panel!==except)$(button)?.setAttribute('aria-expanded','false');
  });
}

function togglePopover(panelId,buttonId){
  const panel=$(panelId),button=$(buttonId);if(!panel||!button)return;
  const opening=panel.hidden;
  closePopovers(opening?panelId:null);
  panel.hidden=!opening;
  button.setAttribute('aria-expanded',String(opening));
  if(opening)requestAnimationFrame(()=>panel.querySelector('button,input,select,textarea')?.focus());
}

function renderQuickCreate(){
  const options=[
    ['prospect','Oportunidad','users-round','crm.write'],['client','Cliente','building-2','clients.write'],
    ['project','Proyecto','briefcase-business','projects.write'],['task','Tarea','list-plus','tasks.write'],
    ['invoice','Comprobante','receipt-text','billing.write'],['email','Correo','mail-plus','communications.send']
  ].filter(item=>app.hasPermission(item[3])||(app.mode==='demo'&&item[3]!=='communications.send'));
  $('quickCreateMenu').innerHTML='<span class="popover-label">CREAR NUEVO</span>'+options.map(item=>'<button type="button" role="menuitem" data-quick-create="'+item[0]+'"><i data-lucide="'+item[2]+'"></i><span><b>'+item[1]+'</b><small>En '+item[3].split('.')[0]+'</small></span></button>').join('');
}

function renderUserMenu(){
  const current=app.currentProfile||{},org=app.activeOrganization||{};
  $('userMenu').innerHTML='<div class="user-menu-head"><span class="avatar">'+esc(app.format.initials(current.full_name||'SC'))+'</span><div><b>'+esc(current.full_name||'Usuario')+'</b><small>'+esc(current.email||'@'+(current.username||'usuario'))+'</small></div></div>'+
    '<span class="popover-label">'+esc(org.name||'Empresa activa')+'</span>'+
    '<button type="button" role="menuitem" data-user-action="profile"><i data-lucide="user-round-cog"></i><span><b>Mi perfil</b><small>Foto y datos personales</small></span></button>'+
    '<button type="button" role="menuitem" data-user-action="password"><i data-lucide="key-round"></i><span><b>Seguridad</b><small>Cambiar contraseña</small></span></button>'+
    '<button type="button" role="menuitem" data-user-action="notifications"><i data-lucide="bell-ring"></i><span><b>Preferencias</b><small>Avisos y resumen</small></span></button>'+
    ((app.hasPermission('team.manage')||app.hasPermission('organization.manage'))?'<button type="button" role="menuitem" data-user-action="settings"><i data-lucide="settings-2"></i><span><b>Configuración</b><small>Empresa y accesos</small></span></button>':'')+
    '<button type="button" role="menuitem" class="menu-danger" data-user-action="logout"><i data-lucide="log-out"></i><span><b>Cerrar sesión</b></span></button>';
}

function renderNotifications(){
  const notifications=app.data.notifications||[];
  const unread=notifications.filter(item=>!item.read_at).length;
  $('notificationBadge').hidden=!unread;
  $('notificationBadge').textContent=unread>99?'99+':String(unread);
  $('notificationList').innerHTML=notifications.length?notifications.map(item=>
    '<button type="button" class="notification-item '+(item.read_at?'':'is-unread')+'" data-notification="'+item.id+'" data-entity="'+esc(item.entity_type||'')+'"><span class="notification-kind status-'+(item.kind==='warning'?'amber':item.kind==='error'?'red':item.kind==='success'?'green':'blue')+'"><i data-lucide="'+(item.kind==='warning'?'triangle-alert':item.kind==='success'?'circle-check':'bell')+'"></i></span><span><b>'+esc(item.title)+'</b><small>'+esc(item.body||'')+'</small><time>'+app.format.fmtDateTime(item.created_at)+'</time></span></button>'
  ).join(''):'<div class="popover-empty"><i data-lucide="bell-off"></i><b>Todo al día</b><span>No hay notificaciones para esta empresa.</span></div>';
}

function renderCommunications(){
  if(!$('emailRows'))return;
  const rows=app.data.emailMessages||[];
  const counts={sent:rows.filter(row=>row.status==='sent').length,queued:rows.filter(row=>row.status==='queued').length,failed:rows.filter(row=>row.status==='failed').length};
  $('communicationKpis').innerHTML=[['Enviados',counts.sent,'send','Entrega confirmada'],['En cola',counts.queued,'clock-3','Pendientes del proveedor'],['Con error',counts.failed,'circle-alert','Requieren revisión']].map(item=>'<article class="kpi"><div class="kpi-top"><span class="kpi-label">'+item[0]+'</span><span class="kpi-icon"><i data-lucide="'+item[2]+'"></i></span></div><strong>'+item[1]+'</strong><small>'+item[3]+'</small></article>').join('');
  const rowMarkup=row=>'<tr><td><span class="row-main"><b>'+esc((row.to_addresses||[]).join(', '))+'</b><small>'+esc((row.cc_addresses||[]).join(', '))+'</small></span></td><td>'+esc(row.subject)+'</td><td>'+esc(app.format.labelFrom(row.related_type||'general'))+'</td><td><span class="status-pill '+emailStatusClass(row.status)+'">'+esc(emailStatus(row.status))+'</span></td><td>'+app.format.fmtDateTime(row.sent_at||row.scheduled_at||row.created_at)+'</td></tr>';
  $('emailRows').innerHTML=rows.length?rows.map(rowMarkup).join(''):'<tr><td colspan="5"><div class="empty-module"><i data-lucide="mail"></i><strong>Sin comunicaciones todavía</strong><span>Los borradores y envíos quedarán trazados aquí.</span></div></td></tr>';
  $('mobileEmails').innerHTML=rows.length?rows.map(row=>'<article class="mobile-card"><div class="mobile-card-top"><b>'+esc(row.subject)+'</b><span class="status-pill '+emailStatusClass(row.status)+'">'+esc(emailStatus(row.status))+'</span></div><p>'+esc((row.to_addresses||[]).join(', '))+'</p><small>'+app.format.fmtDateTime(row.sent_at||row.created_at)+'</small></article>').join(''):'<div class="empty-module">Sin comunicaciones todavía.</div>';
}
const emailStatus=status=>({draft:'Borrador',queued:'En cola',sent:'Enviado',failed:'Falló',cancelled:'Cancelado'})[status]||status;
const emailStatusClass=status=>({sent:'status-green',queued:'status-amber',failed:'status-red',draft:'status-gray',cancelled:'status-red'})[status]||'status-gray';

function renderSettings(){
  if(!$('settingsSurface')||app.activeView!=='settings')return;
  document.querySelectorAll('[data-settings-tab]').forEach(button=>button.classList.toggle('active',button.dataset.settingsTab===settingsTab));
  const render={company:companySettings,permissions:permissionsSettings,notifications:notificationSettings,integrations:integrationSettings}[settingsTab];
  $('settingsSurface').innerHTML=render();
  bindSettingsForm();
  icon();
}

function companySettings(){
  const org=app.activeOrganization||{};
  return '<div class="settings-layout"><section class="settings-main"><div class="settings-section-head"><span class="settings-icon"><i data-lucide="building-2"></i></span><div><h3>Identidad de la empresa</h3><p>Datos operativos que se usan en documentos y comunicaciones.</p></div></div><form class="action-form settings-form" id="companySettingsForm"><label>Nombre<input name="name" required maxlength="120" value="'+esc(org.name||'')+'"></label><label>Identificador fiscal<input name="tax_identifier" maxlength="40" value="'+esc(org.tax_identifier||'')+'"></label><label>Correo<input name="contact_email" type="email" maxlength="180" value="'+esc(org.contact_email||'')+'"></label><label>Teléfono<input name="phone" maxlength="40" value="'+esc(org.phone||'')+'"></label><label>Moneda<select name="default_currency"><option '+(org.default_currency==='ARS'?'selected':'')+'>ARS</option><option '+(org.default_currency==='USD'?'selected':'')+'>USD</option></select></label><label>Zona horaria<select name="timezone"><option value="America/Argentina/Buenos_Aires">Argentina · Buenos Aires</option></select></label><label>Color de marca<input name="brand_color" type="color" value="'+esc(org.brand_color||'#0360BD')+'"></label><div class="form-actions"><button class="btn btn-primary" type="submit"><i data-lucide="save"></i>Guardar empresa</button></div></form></section><aside class="settings-aside"><span class="eyebrow">EMPRESA ACTIVA</span><h3>'+esc(org.name||'Empresa')+'</h3><p>'+esc(org.slug||'')+'</p><dl><div><dt>Rol actual</dt><dd>'+esc(app.format.roleLabel(app.currentMembership?.role))+'</dd></div><div><dt>Moneda</dt><dd>'+esc(org.default_currency||'ARS')+'</dd></div><div><dt>Estado</dt><dd>Activa</dd></div></dl></aside></div>';
}

function permissionsSettings(){
  const roles=['owner','admin','commercial','project_manager','accounting','collaborator','viewer'];
  const labels={owner:'Propietario',admin:'Administrador',commercial:'Comercial',project_manager:'Proyectos',accounting:'Administración',collaborator:'Colaborador',viewer:'Lectura'};
  const catalog=permissionCatalog();
  return '<div class="settings-section-head"><span class="settings-icon"><i data-lucide="shield-check"></i></span><div><h3>Matriz de acceso</h3><p>Los permisos personalizados se administran desde cada ficha del equipo.</p></div></div><div class="permission-table-wrap"><table class="permission-table"><thead><tr><th>Permiso</th>'+roles.map(role=>'<th>'+labels[role]+'</th>').join('')+'</tr></thead><tbody>'+catalog.map(permission=>'<tr><td><b>'+esc(permission.label)+'</b><small>'+esc(permission.module)+'</small></td>'+roles.map(role=>'<td><i data-lucide="'+(role==='owner'||app.rolePermissionDefaults.some(item=>item.role===role&&item.permission_code===permission.code&&item.allowed!==false)?'check':'minus')+'"></i></td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

function notificationSettings(){
  const preferences=app.currentMembership?.notification_preferences||{in_app:true,email:true,daily_digest:false};
  return '<div class="settings-layout"><section class="settings-main"><div class="settings-section-head"><span class="settings-icon"><i data-lucide="bell-ring"></i></span><div><h3>Preferencias personales</h3><p>Elegí cómo enterarte de asignaciones, comentarios y vencimientos.</p></div></div><form id="notificationSettingsForm" class="preference-list">'+preferenceRow('in_app','Dentro del CRM','Avisos en tiempo real y centro de actividad.',preferences.in_app!==false,'monitor-dot')+preferenceRow('email','Correo electrónico','Alertas relevantes en tu email de perfil.',preferences.email!==false,'mail')+preferenceRow('daily_digest','Resumen diario','Una síntesis de tareas y actividad pendiente.',preferences.daily_digest===true,'calendar-range')+'<div class="form-actions"><button class="btn btn-primary" type="submit"><i data-lucide="save"></i>Guardar preferencias</button></div></form></section><aside class="settings-aside"><span class="eyebrow">TRAZABILIDAD</span><h3>Avisos con contexto</h3><p>Cada notificación abre el módulo relacionado y conserva empresa, usuario y momento.</p></aside></div>';
}
function preferenceRow(name,title,copy,checked,iconName){return '<label class="preference-row"><span class="settings-icon"><i data-lucide="'+iconName+'"></i></span><span><b>'+title+'</b><small>'+copy+'</small></span><span class="toggle-field"><input type="checkbox" name="'+name+'" '+(checked?'checked':'')+'><span></span></span></label>'}

function integrationSettings(){
  const state=value=>value?.connected===true?'<span class="integration-state is-ok"><i data-lucide="circle-check"></i>Conectada</span>':value?.configured===false||value?.connected===false?'<span class="integration-state is-error"><i data-lucide="circle-alert"></i>Requiere configuración</span>':'<span class="integration-state"><i data-lucide="circle-dashed"></i>Sin verificar</span>';
  const openai=integrationState.openai;
  const openaiMeta=openai?'<div class="integration-meta"><span><b>Cuenta</b>'+esc(openai.account?.label||'Sin identificar')+'</span><span><b>Proyecto</b>'+esc(openai.account?.project_id||'Sin informar')+'</span><span><b>Modelos</b>'+esc(String(openai.available_models?.length||openai.allowed_models?.length||0))+' habilitados</span></div>':'';
  return '<div class="integration-grid">'+
    '<article class="integration-card"><span class="integration-logo openai-mark">AI</span><div class="integration-copy"><h3>OpenAI Responses API</h3><p>Motor seguro para agentes comerciales, presupuestos y asistentes configurables.</p>'+state(openai)+openaiMeta+'</div><div class="integration-actions"><button class="btn btn-secondary" type="button" data-check-integration="openai" aria-label="Verificar OpenAI"><i data-lucide="refresh-cw"></i>Verificar</button><button class="btn btn-primary" type="button" data-configure-integration="openai"><i data-lucide="settings-2"></i>Configurar</button></div></article>'+
    '<article class="integration-card"><span class="integration-logo"><i data-lucide="mail"></i></span><div class="integration-copy"><h3>Correo transaccional</h3><p>Envíos trazables mediante Resend, con adjuntos privados autorizados.</p>'+state(integrationState.email)+'</div><div class="integration-actions"><button class="btn btn-secondary" type="button" data-check-integration="email" aria-label="Verificar correo"><i data-lucide="refresh-cw"></i>Verificar</button><button class="btn btn-primary" type="button" data-configure-integration="email"><i data-lucide="settings-2"></i>Configurar</button></div></article>'+
    '<article class="integration-card"><span class="integration-logo"><i data-lucide="database"></i></span><div class="integration-copy"><h3>Supabase</h3><p>Autenticación, PostgreSQL, Storage, Realtime y funciones seguras.</p><span class="integration-state is-ok"><i data-lucide="circle-check"></i>Conectada</span></div><div class="integration-actions"><button class="btn btn-secondary" type="button" disabled><i data-lucide="shield-check"></i>Activa</button></div></article>'+
    '</div><p class="section-disclaimer"><i data-lucide="shield-check"></i>Las credenciales privadas viven como secretos del servidor. SC Gestión nunca las muestra ni las guarda en el navegador.</p>';
}

function bindSettingsForm(){
  $('companySettingsForm')?.addEventListener('submit',saveCompany);
  $('notificationSettingsForm')?.addEventListener('submit',saveNotificationPreferences);
}

async function saveCompany(event){
  event.preventDefault();if(!app.hasPermission('organization.manage'))return app.notify('Solo un propietario puede editar la empresa.');
  const values=Object.fromEntries(new FormData(event.target));
  const payload={name:values.name.trim(),tax_identifier:values.tax_identifier.trim()||null,contact_email:values.contact_email.trim()||null,phone:values.phone.trim()||null,default_currency:values.default_currency,timezone:values.timezone,brand_color:values.brand_color};
  if(app.mode==='demo'){Object.assign(app.activeOrganization,payload);app.saveDemo();renderSettings();app.notify('Empresa actualizada en la demo');return}
  const {error}=await app.supabase.from('organizations').update(payload).eq('id',app.activeOrganization.id);
  if(error)return app.notify(error.message);
  Object.assign(app.activeOrganization,payload);renderSettings();app.notify('Datos de empresa actualizados');
}

async function saveNotificationPreferences(event){
  event.preventDefault();const values=new FormData(event.target);
  const preferences={in_app:values.get('in_app')==='on',email:values.get('email')==='on',daily_digest:values.get('daily_digest')==='on'};
  if(app.mode==='demo'){app.currentMembership.notification_preferences=preferences;renderSettings();app.notify('Preferencias guardadas');return}
  const {error}=await app.supabase.rpc('update_my_notification_preferences',{target_organization_id:app.activeOrganization.id,new_preferences:preferences});
  if(error)return app.notify(error.message);
  app.currentMembership.notification_preferences=preferences;app.notify('Preferencias guardadas');
}

function openNewOrganization(){
  showAction('Nueva empresa','ESPACIO MULTIEMPRESA','<form class="action-form" id="newOrganizationForm"><label>Nombre<input name="name" required maxlength="120" placeholder="Ej.: Estudio Norte"></label><label>Identificador URL<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="estudio-norte"></label><label>Moneda<select name="currency"><option>ARS</option><option>USD</option></select></label><p class="module-form-note">Se creará un espacio aislado y quedarás registrado como propietario.</p><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary" type="submit">Crear empresa</button></div></form>');
  $('newOrganizationForm').onsubmit=createOrganization;
}
async function createOrganization(event){
  event.preventDefault();const values=Object.fromEntries(new FormData(event.target));
  if(app.mode==='demo')return app.notify('La creación multiempresa requiere Supabase conectado.');
  const {error}=await app.supabase.rpc('create_organization',{new_name:values.name.trim(),new_slug:values.slug.trim().toLowerCase(),new_currency:values.currency});
  if(error)return app.notify(error.message);
  app.notify('Empresa creada. Actualizando espacios...');setTimeout(()=>location.reload(),650);
}

function openAddMember(){
  showAction('Agregar usuario','EQUIPO Y ACCESOS','<form class="action-form" id="addMemberForm"><label class="full-field">Usuario<input name="username" required autocomplete="off" placeholder="Ej.: areyes"><small>Debe ser un usuario ya registrado en SC Gestión.</small></label><label>Rol<select name="role">'+roleOptions('commercial')+'</select></label><label class="member-status-control">Estado<span class="toggle-field"><input name="active" type="checkbox" checked><span></span><b>Acceso activo</b></span></label><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary" type="submit"><i data-lucide="user-plus"></i>Agregar al equipo</button></div></form>');
  $('addMemberForm').onsubmit=saveMember;
}
function roleOptions(selected){return Object.entries({owner:'Propietario',admin:'Administrador',commercial:'Comercial',project_manager:'Responsable de proyectos',accounting:'Administración',collaborator:'Colaborador',viewer:'Solo lectura'}).map(([value,label])=>'<option value="'+value+'" '+(value===selected?'selected':'')+'>'+label+'</option>').join('')}
async function saveMember(event){
  event.preventDefault();const values=Object.fromEntries(new FormData(event.target));
  if(app.mode==='demo')return app.notify('El alta de usuarios requiere Supabase conectado.');
  const {error}=await app.supabase.rpc('upsert_organization_member',{target_organization_id:app.activeOrganization.id,target_username:values.username.trim(),new_role:values.role,new_active:true,new_permission_overrides:{}});
  if(error)return app.notify(error.message);
  app.closeModal('actionModal');await app.reload();app.notify('Usuario agregado a la empresa');
}

function openMemberPermissions(userId){
  const member=membership(userId),person=profile(userId);if(!member||!person)return;
  const defaults=new Set(app.rolePermissionDefaults.filter(item=>item.role===member.role&&item.allowed!==false).map(item=>item.permission_code));
  const overrides=member.permission_overrides||{};
  const groups=Object.groupBy?Object.groupBy(permissionCatalog(),item=>item.module):permissionCatalog().reduce((result,item)=>((result[item.module]??=[]).push(item),result),{});
  const fields=Object.entries(groups).map(([module,items])=>'<fieldset class="permission-group"><legend>'+esc(module)+'</legend>'+items.map(item=>{const base=member.role==='owner'||defaults.has(item.code),allowed=Object.prototype.hasOwnProperty.call(overrides,item.code)?overrides[item.code]:base;return '<label class="permission-toggle"><span><b>'+esc(item.label)+'</b><small>'+esc(item.description||item.code)+'</small></span><span class="toggle-field"><input type="checkbox" name="permission" value="'+esc(item.code)+'" data-default="'+String(base)+'" '+(allowed?'checked':'')+' '+(member.role==='owner'?'disabled':'')+'><span></span></span></label>'}).join('')+'</fieldset>').join('');
  showAction('Permisos de '+person.full_name,'CONTROL DE ACCESO','<form id="memberPermissionForm"><div class="permission-member-head"><span class="avatar">'+esc(app.format.initials(person.full_name))+'</span><div><b>'+esc(person.full_name)+'</b><small>'+esc(app.format.roleLabel(member.role))+' · @'+esc(person.username)+'</small></div></div><div class="permission-groups">'+fields+'</div><div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-primary" type="submit" '+(member.role==='owner'?'disabled':'')+'>Guardar permisos</button></div></form>',{wide:true});
  $('memberPermissionForm').onsubmit=event=>saveMemberPermissions(event,person,member);
}
async function saveMemberPermissions(event,person,member){
  event.preventDefault();const overrides={};
  event.target.querySelectorAll('input[name="permission"]').forEach(input=>{const value=input.checked,base=input.dataset.default==='true';if(value!==base)overrides[input.value]=value});
  if(app.mode==='demo'){member.permission_overrides=overrides;app.closeModal('actionModal');app.saveDemo();app.notify('Permisos actualizados');return}
  const {error}=await app.supabase.rpc('upsert_organization_member',{target_organization_id:app.activeOrganization.id,target_username:person.username,new_role:member.role,new_active:member.active!==false,new_permission_overrides:overrides});
  if(error)return app.notify(error.message);
  app.closeModal('actionModal');await app.reload();app.notify('Permisos actualizados');
}

function openTaskDetail(taskId){
  const item=task(taskId);if(!item)return;
  const comments=app.data.taskComments.filter(comment=>comment.task_id===taskId);
  const checklist=Array.isArray(item.checklist)?item.checklist.filter(entry=>entry&&entry.id&&entry.label):[];
  const completedItems=checklist.filter(entry=>entry.done).length;
  const subtasks=app.data.tasks.filter(entry=>entry.parent_task_id===taskId);
  const watched=app.data.taskWatchers.some(watcher=>watcher.task_id===taskId&&watcher.user_id===app.currentUser?.id);
  const status={pendiente:'Pendiente',en_progreso:'En progreso',completada:'Completada',cancelada:'Cancelada'}[item.status]||item.status;
  const checklistMarkup='<section class="task-work-section"><div class="task-section-head"><div><span class="eyebrow">CHECKLIST</span><h3>Pasos de la tarea</h3></div><strong>'+completedItems+'/'+checklist.length+'</strong></div><div class="task-progress-track"><i style="width:'+(checklist.length?Math.round(completedItems/checklist.length*100):0)+'%"></i></div><div class="checklist-list">'+(checklist.length?checklist.map(entry=>'<div class="checklist-row '+(entry.done?'is-done':'')+'"><button type="button" data-checklist-toggle="'+item.id+'" data-checklist-item="'+esc(entry.id)+'" aria-label="'+(entry.done?'Marcar pendiente':'Marcar completado')+'"><i data-lucide="'+(entry.done?'circle-check-big':'circle')+'"></i></button><span>'+esc(entry.label)+'</span>'+(app.hasPermission('tasks.write')?'<button type="button" class="checklist-remove" data-checklist-remove="'+item.id+'" data-checklist-item="'+esc(entry.id)+'" aria-label="Eliminar paso"><i data-lucide="x"></i></button>':'')+'</div>').join(''):'<div class="task-empty-inline">Todavía no hay pasos definidos.</div>')+'</div>'+(app.hasPermission('tasks.write')?'<form id="taskChecklistForm" class="task-inline-form"><input name="label" maxlength="180" required placeholder="Agregar un paso concreto"><button class="icon-btn" type="submit" aria-label="Agregar paso"><i data-lucide="plus"></i></button></form>':'')+'</section>';
  const memberOptions=app.data.organizationMemberships.filter(entry=>entry.active!==false).map(entry=>profile(entry.user_id)).filter(Boolean).map(person=>'<option value="'+person.id+'" '+(person.id===item.assigned_to?'selected':'')+'>'+esc(person.full_name)+'</option>').join('');
  const subtasksMarkup='<section class="task-work-section"><div class="task-section-head"><div><span class="eyebrow">SUBTAREAS</span><h3>Trabajo relacionado</h3></div><strong>'+subtasks.filter(entry=>entry.status==='completada').length+'/'+subtasks.length+'</strong></div><div class="subtask-list">'+(subtasks.length?subtasks.map(entry=>'<article class="subtask-row"><button type="button" class="subtask-open" data-task-open="'+entry.id+'"><i data-lucide="'+(entry.status==='completada'?'circle-check-big':'circle-dashed')+'"></i><span><b>'+esc(entry.title)+'</b><small>'+esc(profile(entry.assigned_to)?.full_name||'Sin asignar')+' · '+app.format.fmtDateTime(entry.due_at)+'</small></span></button>'+(app.hasPermission('tasks.write')?'<button type="button" class="mini-btn" data-subtask-toggle="'+entry.id+'" data-parent-task="'+item.id+'">'+(entry.status==='completada'?'Reabrir':'Completar')+'</button>':'')+'</article>').join(''):'<div class="task-empty-inline">Sin subtareas pendientes.</div>')+'</div>'+(app.hasPermission('tasks.write')?'<form id="taskSubtaskForm" class="task-subtask-form"><input name="title" maxlength="180" required placeholder="Nueva subtarea"><select name="assigned_to"><option value="">Sin asignar</option>'+memberOptions+'</select><button class="btn btn-secondary" type="submit"><i data-lucide="corner-down-right"></i>Agregar</button></form>':'')+'</section>';
  const commentsMarkup='<section class="comment-section"><div class="settings-section-head"><span class="settings-icon"><i data-lucide="messages-square"></i></span><div><h3>Conversación</h3><p>'+comments.length+' comentario'+(comments.length===1?'':'s')+'</p></div></div><div class="comment-list">'+(comments.length?comments.map(comment=>'<article class="comment"><span class="avatar">'+esc(app.format.initials(profile(comment.author_id)?.full_name||'Usuario'))+'</span><div><b>'+esc(profile(comment.author_id)?.full_name||'Usuario')+'</b><time>'+app.format.fmtDateTime(comment.created_at)+'</time><p>'+esc(comment.body)+'</p></div></article>').join(''):'<div class="popover-empty"><b>Sin comentarios</b><span>Dejá una actualización para el equipo.</span></div>')+'</div>'+(app.hasPermission('tasks.comment')?'<form id="taskCommentForm" class="comment-form"><textarea name="body" required maxlength="5000" placeholder="Escribí una actualización. Podés mencionar con @usuario."></textarea><button class="btn btn-primary" type="submit"><i data-lucide="send"></i>Comentar</button></form>':'')+'</section>';
  showAction(item.title,'DETALLE DE TAREA','<div class="task-detail"><div class="task-detail-grid"><div><span>Estado</span><b>'+esc(status)+'</b></div><div><span>Responsable</span><b>'+esc(profile(item.assigned_to)?.full_name||'Sin asignar')+'</b></div><div><span>Prioridad</span><b>'+esc(item.priority)+'</b></div><div><span>Vencimiento</span><b>'+app.format.fmtDateTime(item.due_at)+'</b></div></div><p class="task-description">'+esc(item.description||'Sin descripción')+'</p><div class="task-detail-actions"><button type="button" class="btn btn-secondary" data-task-watch="'+item.id+'"><i data-lucide="'+(watched?'eye-off':'eye')+'"></i>'+(watched?'Dejar de seguir':'Seguir tarea')+'</button></div><div class="task-work-grid">'+checklistMarkup+subtasksMarkup+'</div>'+commentsMarkup+'</div>',{wide:true});
  $('taskCommentForm')?.addEventListener('submit',event=>saveTaskComment(event,item.id));
  $('taskChecklistForm')?.addEventListener('submit',event=>addChecklistItem(event,item.id));
  $('taskSubtaskForm')?.addEventListener('submit',event=>addSubtask(event,item));
}
async function persistTaskPatch(taskId,patch,parentTaskId=taskId){
  const item=task(taskId);if(!item)return;
  if(app.mode==='demo'){Object.assign(item,patch,{updated_at:new Date().toISOString()});app.saveDemo();openTaskDetail(parentTaskId);return}
  const {error}=await app.supabase.from('tasks').update(patch).eq('organization_id',app.activeOrganization.id).eq('id',taskId);
  if(error)return app.notify(error.message);
  await app.reload();openTaskDetail(parentTaskId);
}
async function addChecklistItem(event,taskId){
  event.preventDefault();const item=task(taskId),label=new FormData(event.target).get('label').trim();if(!item||!label)return;
  const checklist=Array.isArray(item.checklist)?item.checklist.slice():[];
  checklist.push({id:crypto.randomUUID(),label,done:false});
  await persistTaskPatch(taskId,{checklist});app.notify('Paso agregado');
}
async function updateChecklist(taskId,itemId,action){
  const item=task(taskId);if(!item)return;
  const checklist=(Array.isArray(item.checklist)?item.checklist:[]).map(entry=>({...entry}));
  const next=action==='remove'?checklist.filter(entry=>entry.id!==itemId):checklist.map(entry=>entry.id===itemId?{...entry,done:!entry.done}:entry);
  await persistTaskPatch(taskId,{checklist:next});
}
async function addSubtask(event,parent){
  event.preventDefault();const values=new FormData(event.target),title=values.get('title').trim();if(!title)return;
  const payload={organization_id:app.activeOrganization.id,parent_task_id:parent.id,prospect_id:parent.prospect_id||null,assigned_to:values.get('assigned_to')||null,created_by:app.currentUser.id,title,description:null,priority:parent.priority||'media',status:'pendiente',due_at:parent.due_at||null,checklist:[]};
  if(app.mode==='demo'){app.data.tasks.push({id:crypto.randomUUID(),...payload,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});app.saveDemo();openTaskDetail(parent.id);app.notify('Subtarea creada');return}
  const {error}=await app.supabase.from('tasks').insert(payload);if(error)return app.notify(error.message);
  await app.reload();openTaskDetail(parent.id);app.notify('Subtarea creada');
}
async function toggleSubtask(taskId,parentTaskId){
  const item=task(taskId);if(!item)return;
  const status=item.status==='completada'?'pendiente':'completada';
  await persistTaskPatch(taskId,{status,completed_at:status==='completada'?new Date().toISOString():null},parentTaskId);
}
async function saveTaskComment(event,taskId){
  event.preventDefault();const body=new FormData(event.target).get('body').trim();if(!body)return;
  const usernames=[...body.matchAll(/@([a-z0-9._-]+)/gi)].map(match=>match[1].toLowerCase());
  const mentions=app.data.profiles.filter(person=>usernames.includes(person.username?.toLowerCase())).map(person=>person.id);
  const payload={id:crypto.randomUUID(),organization_id:app.activeOrganization.id,task_id:taskId,author_id:app.currentUser.id,body,mentions,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(app.mode==='demo'){app.data.taskComments.push(payload);app.saveDemo();openTaskDetail(taskId);return}
  const {id:_localId,...remotePayload}=payload;
  const {error}=await app.supabase.from('task_comments').insert(remotePayload);
  if(error)return app.notify(error.message);
  await app.reload();openTaskDetail(taskId);app.notify('Comentario publicado');
}
async function toggleTaskWatch(taskId){
  const existing=app.data.taskWatchers.find(item=>item.task_id===taskId&&item.user_id===app.currentUser.id);
  if(app.mode==='demo'){
    if(existing)app.data.taskWatchers=app.data.taskWatchers.filter(item=>item!==existing);else app.data.taskWatchers.push({organization_id:app.activeOrganization.id,task_id:taskId,user_id:app.currentUser.id});
    app.saveDemo();openTaskDetail(taskId);return;
  }
  const query=existing?app.supabase.from('task_watchers').delete().eq('task_id',taskId).eq('user_id',app.currentUser.id):app.supabase.from('task_watchers').insert({organization_id:app.activeOrganization.id,task_id:taskId,user_id:app.currentUser.id});
  const {error}=await query;if(error)return app.notify(error.message);
  await app.reload();openTaskDetail(taskId);
}

function openEmailComposer({invoiceId=null,attachmentPath=null}={}){
  const inv=invoice(invoiceId),customer=client(inv?.client_id),templates=app.data.emailTemplates||[];
  showAction('Nuevo correo','COMUNICACIÓN TRAZABLE','<form class="action-form" id="emailComposerForm"><label class="full-field">Plantilla<select name="template"><option value="">Sin plantilla</option>'+templates.map(item=>'<option value="'+item.id+'">'+esc(item.name)+'</option>').join('')+'</select></label><label class="full-field">Para<input name="to" type="text" required value="'+esc(customer?.email||'')+'" placeholder="cliente@empresa.com"></label><label class="full-field">Asunto<input name="subject" required maxlength="240" value="'+esc(inv?'Comprobante interno '+inv.internal_number:'')+'"></label><label class="full-field">Mensaje<textarea name="body" rows="8" required placeholder="Escribí el mensaje para el destinatario.">'+esc(inv?'Hola '+(customer?.contact_name||'')+',\n\nAdjuntamos el comprobante interno '+inv.internal_number+'.\n\nSaludos,\n'+(app.activeOrganization?.name||'SC Gestión'):'')+'</textarea></label><input type="hidden" name="invoice_id" value="'+esc(invoiceId||'')+'"><input type="hidden" name="attachment_path" value="'+esc(attachmentPath||'')+'">'+(attachmentPath?'<p class="module-form-note"><i data-lucide="paperclip"></i> Se adjuntará el PDF generado.</p>':'')+'<div class="form-actions"><button type="button" class="btn btn-secondary" data-close="actionModal">Cancelar</button><button class="btn btn-secondary" type="submit" name="intent" value="draft">Guardar borrador</button><button class="btn btn-primary" type="submit" name="intent" value="send"><i data-lucide="send"></i>Enviar ahora</button></div></form>',{wide:true});
  $('emailComposerForm').onsubmit=saveEmail;
  $('emailComposerForm').elements.template.onchange=event=>{const template=templates.find(item=>item.id===event.target.value);if(template){event.target.form.elements.subject.value=template.subject;event.target.form.elements.body.value=htmlToText(template.html_body)}};
}
const htmlToText=html=>String(html||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').trim();
const parseEmails=value=>String(value||'').split(/[;,\s]+/).map(item=>item.trim()).filter(Boolean);
async function saveEmail(event){
  event.preventDefault();const values=new FormData(event.target),intent=event.submitter?.value||'draft';
  const recipients=parseEmails(values.get('to'));if(!recipients.length||recipients.some(address=>!/^\S+@\S+\.\S+$/.test(address)))return app.notify('Revisá los destinatarios.');
  const message={organization_id:app.activeOrganization.id,created_by:app.currentUser.id,to_addresses:recipients,cc_addresses:[],subject:values.get('subject').trim(),html_body:esc(values.get('body')).replace(/\n/g,'<br>'),text_body:values.get('body').trim(),attachment_paths:values.get('attachment_path')?[values.get('attachment_path')]:[],related_type:values.get('invoice_id')?'invoice':'general',related_id:values.get('invoice_id')||null,status:intent==='send'?'queued':'draft'};
  if(app.mode==='demo'){message.id=crypto.randomUUID();message.created_at=new Date().toISOString();if(intent==='send'){message.status='sent';message.sent_at=new Date().toISOString()}app.data.emailMessages.unshift(message);app.closeModal('actionModal');app.saveDemo();app.notify(intent==='send'?'Correo simulado enviado':'Borrador guardado');return}
  const {data:created,error}=await app.supabase.from('email_messages').insert(message).select('*').single();if(error)return app.notify(error.message);
  if(intent==='send'){
    const {error:sendError}=await app.supabase.functions.invoke('communications',{body:{action:'send',message_id:created.id}});
    if(sendError){app.notify('El correo quedó en cola, pero el proveedor no respondió.');await app.reload();return}
  }
  app.closeModal('actionModal');await app.reload();app.notify(intent==='send'?'Correo enviado':'Borrador guardado');
}

async function invoiceEmail(invoiceId){
  app.notify('Preparando PDF adjunto...');
  const result=await generateInvoicePdf(invoiceId,{download:false});if(!result)return;
  openEmailComposer({invoiceId,attachmentPath:result.storagePath});
}

async function imageAsPng(path){
  return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);resolve({data:canvas.toDataURL('image/png'),ratio:image.naturalWidth/image.naturalHeight})};image.onerror=reject;image.src=path});
}
async function generateInvoicePdf(invoiceId,{download=true}={}){
  const inv=invoice(invoiceId);if(!inv)return null;
  const customer=client(inv.client_id)||{};const org=app.activeOrganization||{};
  const items=app.data.invoiceItems.filter(item=>item.invoice_id===invoiceId);
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  try{const logo=await imageAsPng('./assets/img/sc-isotipo-color.webp');const width=34,height=Math.min(15,width/logo.ratio);doc.addImage(logo.data,'PNG',16,13,width,height)}catch{}
  doc.setTextColor(31,47,60);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(org.name||'Soluciones Conectadas',194,18,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(94,115,130);doc.text('DOCUMENTO INTERNO NO FISCAL',194,24,{align:'right'});
  doc.setDrawColor(211,224,233);doc.line(16,34,194,34);doc.setTextColor(31,47,60);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('Comprobante interno',16,49);doc.setFontSize(10);doc.text(inv.internal_number||'Sin número',16,57);
  doc.setFont('helvetica','normal');doc.setTextColor(94,115,130);doc.text('Fecha',120,46);doc.text('Vencimiento',120,54);doc.text('Estado',120,62);doc.setTextColor(31,47,60);doc.text(app.format.fmtDate(inv.issue_date||inv.created_at),194,46,{align:'right'});doc.text(app.format.fmtDate(inv.due_date),194,54,{align:'right'});doc.text(app.format.labelFrom(inv.status),194,62,{align:'right'});
  doc.setFillColor(245,249,252);doc.roundedRect(16,70,178,30,2,2,'F');doc.setTextColor(94,115,130);doc.setFontSize(8);doc.text('CLIENTE',22,79);doc.setTextColor(31,47,60);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(customer.business_name||'Sin cliente asociado',22,87);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text([customer.tax_identifier,customer.email,customer.phone].filter(Boolean).join(' · ')||'Sin datos adicionales',22,94);
  let y=112;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('DETALLE',16,y);y+=8;doc.setFillColor(43,58,70);doc.rect(16,y-5,178,8,'F');doc.setTextColor(255,255,255);doc.text('Concepto',20,y);doc.text('Cantidad',132,y,{align:'right'});doc.text('Precio',160,y,{align:'right'});doc.text('Subtotal',190,y,{align:'right'});y+=8;
  const lines=items.length?items:[{description:inv.description||'Servicios profesionales',quantity:1,unit_price:inv.subtotal||inv.total,subtotal:inv.subtotal||inv.total}];
  lines.forEach((item,index)=>{if(y>245){doc.addPage();y=22}if(index%2===0){doc.setFillColor(248,250,252);doc.rect(16,y-5,178,9,'F')}doc.setTextColor(31,47,60);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(String(item.description||'Concepto').slice(0,70),20,y);doc.text(String(item.quantity||1),132,y,{align:'right'});doc.text(app.format.money(item.unit_price||0,inv.currency),160,y,{align:'right'});doc.text(app.format.money(item.subtotal||0,inv.currency),190,y,{align:'right'});y+=10});
  y=Math.max(y+6,175);doc.setDrawColor(211,224,233);doc.line(120,y,194,y);doc.setFontSize(9);doc.setTextColor(94,115,130);doc.text('Subtotal',150,y+9,{align:'right'});doc.text('Impuestos',150,y+17,{align:'right'});doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(31,47,60);doc.text('TOTAL',150,y+28,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(app.format.money(inv.subtotal||0,inv.currency),194,y+9,{align:'right'});doc.text(app.format.money(inv.tax_amount||0,inv.currency),194,y+17,{align:'right'});doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(app.format.money(inv.total||0,inv.currency),194,y+28,{align:'right'});
  doc.setFont('helvetica','bold');doc.setFontSize(42);doc.setTextColor(225,232,237);doc.text('NO FISCAL',105,155,{align:'center',angle:35});doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(110,128,141);doc.text('Generado por SC Gestión · Documento interno sin validez fiscal',105,286,{align:'center'});
  const fileName=(inv.internal_number||'comprobante').replace(/[^a-z0-9_-]+/gi,'-')+'.pdf';const blob=doc.output('blob');let storagePath=null;
  if(app.mode==='supabase'){
    storagePath=app.activeOrganization.id+'/invoices/'+inv.id+'/'+Date.now()+'-'+fileName;
    const {error:uploadError}=await app.supabase.storage.from('generated-pdfs').upload(storagePath,blob,{contentType:'application/pdf',upsert:false});if(uploadError){app.notify(uploadError.message);return null}
    const version=app.data.generatedDocuments.filter(item=>item.invoice_id===inv.id).length+1;
    const {error:recordError}=await app.supabase.from('generated_documents').insert({organization_id:app.activeOrganization.id,invoice_id:inv.id,document_type:'invoice_pdf',version,storage_path:storagePath,file_name:fileName,created_by:app.currentUser.id});if(recordError){app.notify(recordError.message);return null}
    await app.reload();
  }else{
    storagePath='demo/'+fileName;app.data.generatedDocuments.push({id:crypto.randomUUID(),organization_id:app.activeOrganization.id,invoice_id:inv.id,document_type:'invoice_pdf',version:1,storage_path:storagePath,file_name:fileName,created_at:new Date().toISOString()});app.saveDemo();
  }
  if(download)doc.save(fileName);
  app.notify(download?'PDF generado':'PDF preparado');return {storagePath,fileName,blob};
}

async function markNotification(id,entity){
  const item=app.data.notifications.find(row=>row.id===id);if(!item)return;
  if(!item.read_at){item.read_at=new Date().toISOString();if(app.mode==='supabase')await app.supabase.from('notifications').update({read_at:item.read_at}).eq('id',id);renderNotifications()}
  if(entity==='task')app.setView('tasks');closePopovers();
}
async function markAllNotifications(){
  const now=new Date().toISOString();app.data.notifications.forEach(item=>{if(!item.read_at)item.read_at=now});
  if(app.mode==='supabase')await app.supabase.from('notifications').update({read_at:now}).eq('organization_id',app.activeOrganization.id).eq('user_id',app.currentUser.id).is('read_at',null);
  renderNotifications();app.notify('Notificaciones marcadas como leídas');
}

async function integrationError(error){
  try{
    if(error?.context instanceof Response)return await error.context.clone().json();
  }catch{}
  return {message:error?.message||'No se pudo verificar la integración.'};
}

async function checkIntegration(kind,{silent=false}={}){
  if(app.mode==='demo'){
    integrationState[kind]=kind==='openai'?{configured:true,connected:true,message:'Conexión demo verificada.',account:{label:'SC · Proyecto Demo',project_id:'demo'},allowed_models:['gpt-6-luna','gpt-6-sol','gpt-5-mini'],available_models:['gpt-6-luna','gpt-6-sol','gpt-5-mini']}:{configured:true,connected:true};
    renderSettings();return integrationState[kind];
  }
  const functionName=kind==='openai'?'ai-agent':'communications';
  const {data,error}=await app.supabase.functions.invoke(functionName,{body:{action:'connection_status',organization_id:app.activeOrganization.id}});
  integrationState[kind]=error?{configured:false,connected:false,...await integrationError(error)}:{...data,connected:data?.connected??data?.configured===true};
  renderSettings();
  if(!silent)app.notify(integrationState[kind].connected?'Integración disponible':integrationState[kind].message||'La integración requiere configuración');
  return integrationState[kind];
}

async function openIntegrationSetup(kind){
  const status=await checkIntegration(kind,{silent:true});
  const projectRef=(window.SC_CONFIG?.SUPABASE_URL||'').match(/^https:\/\/([^.]+)/)?.[1]||'';
  const secretsUrl=projectRef?'https://supabase.com/dashboard/project/'+projectRef+'/functions/secrets':'https://supabase.com/dashboard';
  const isOpenAI=kind==='openai';
  const required=isOpenAI?['OPENAI_API_KEY','OPENAI_ACCOUNT_LABEL','OPENAI_PROJECT_ID','OPENAI_ORGANIZATION_ID','OPENAI_ALLOWED_MODELS']:['RESEND_API_KEY','RESEND_FROM','RESEND_REPLY_TO'];
  const provider=isOpenAI?'OpenAI':'Resend';
  const providerUrl=isOpenAI?'https://platform.openai.com/api-keys':'https://resend.com/api-keys';
  const account=status?.account||{};
  const models=status?.available_models?.length?status.available_models:status?.allowed_models||[];
  const details=isOpenAI?'<div class="integration-detail-grid"><div><span>Cuenta operativa</span><b>'+esc(account.label||'Sin identificar')+'</b></div><div><span>Proyecto</span><b>'+esc(account.project_id||'Sin informar')+'</b></div><div class="full"><span>Modelos habilitados</span><b>'+esc(models.join(', ')||'Pendientes de verificación')+'</b></div></div>':'';
  showAction('Configurar '+provider,'INTEGRACIÓN SEGURA','<div class="integration-setup"><section class="integration-setup-status '+(status?.connected?'is-connected':'is-pending')+'"><i data-lucide="'+(status?.connected?'badge-check':'circle-alert')+'"></i><div><b>'+(status?.connected?'Conexión verificada':'Configuración pendiente')+'</b><p>'+esc(status?.message||(status?.connected?'El servicio respondió correctamente.':'Completá los secretos del servidor.'))+'</p></div></section>'+details+'<section class="integration-setup-copy"><h3>'+(isOpenAI?'Conexión por proyecto, no por ChatGPT':'Credenciales del proveedor')+'</h3><p>'+(isOpenAI?'La API de OpenAI usa una clave de proyecto alojada en el servidor. No existe un inicio de sesión de ChatGPT que deba abrirse dentro del CRM. La etiqueta de cuenta permite identificar qué proyecto está pagando y ejecutando los agentes.':'Las credenciales de envío se guardan en Supabase Secrets y nunca se exponen al navegador.')+'</p></section><ol class="integration-steps"><li><span>1</span><div><b>Ingresá a '+provider+'</b><p>Creá o seleccioná la credencial del proyecto de producción.</p></div></li><li><span>2</span><div><b>Configurá Supabase Secrets</b><p>'+required.map(name=>'<code>'+name+'</code>').join(' ')+'</p></div></li><li><span>3</span><div><b>Volvé a verificar</b><p>SC Gestión validará la conexión sin mostrar la clave privada.</p></div></li></ol><div class="integration-setup-actions"><a class="btn btn-secondary" href="'+providerUrl+'" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Abrir '+provider+'</a><a class="btn btn-secondary" href="'+secretsUrl+'" target="_blank" rel="noopener"><i data-lucide="shield-keyhole"></i>Abrir secretos</a><button type="button" class="btn btn-secondary" data-copy-integration="'+kind+'"><i data-lucide="copy"></i>Copiar variables</button><button type="button" class="btn btn-primary" data-retry-integration="'+kind+'"><i data-lucide="refresh-cw"></i>Verificar ahora</button></div></div>',{wide:true});
}

async function retryIntegration(kind){
  await checkIntegration(kind,{silent:true});
  await openIntegrationSetup(kind);
}

function renderAll(){
  if(!isAppVisible())return;
  renderQuickCreate();renderUserMenu();renderNotifications();renderCommunications();renderSettings();icon();
}

function bind(){
  $('quickCreateBtn')?.addEventListener('click',event=>{event.stopPropagation();togglePopover('quickCreateMenu','quickCreateBtn')});
  $('notificationBtn')?.addEventListener('click',event=>{event.stopPropagation();togglePopover('notificationPanel','notificationBtn')});
  $('userPill')?.addEventListener('click',event=>{event.stopPropagation();togglePopover('userMenu','userPill')});
  $('markNotificationsRead')?.addEventListener('click',markAllNotifications);
  $('composeEmailBtn')?.addEventListener('click',()=>openEmailComposer());
  $('addMemberBtn')?.addEventListener('click',openAddMember);
  $('newOrganizationBtn')?.addEventListener('click',openNewOrganization);
  document.addEventListener('click',event=>{
    if(!event.target.closest('.popover-wrap'))closePopovers();
    const quick=event.target.closest('[data-quick-create]');if(quick){closePopovers();const type=quick.dataset.quickCreate;if(type==='prospect')$('newProspectBtn').click();else if(type==='email')openEmailComposer();else app.openAction(type);return}
    const userAction=event.target.closest('[data-user-action]')?.dataset.userAction;if(userAction){closePopovers();if(userAction==='profile')app.openAction('profile');if(userAction==='password')app.openAction('changePassword');if(userAction==='notifications'){settingsTab='notifications';app.setView('settings')}if(userAction==='settings')app.setView('settings');if(userAction==='logout')$('logoutBtn').click();return}
    const notification=event.target.closest('[data-notification]');if(notification){markNotification(notification.dataset.notification,notification.dataset.entity);return}
    const taskButton=event.target.closest('[data-task-open]');if(taskButton){openTaskDetail(taskButton.dataset.taskOpen);return}
    const watch=event.target.closest('[data-task-watch]');if(watch){toggleTaskWatch(watch.dataset.taskWatch);return}
    const checklistToggle=event.target.closest('[data-checklist-toggle]');if(checklistToggle){updateChecklist(checklistToggle.dataset.checklistToggle,checklistToggle.dataset.checklistItem,'toggle');return}
    const checklistRemove=event.target.closest('[data-checklist-remove]');if(checklistRemove){updateChecklist(checklistRemove.dataset.checklistRemove,checklistRemove.dataset.checklistItem,'remove');return}
    const subtaskToggle=event.target.closest('[data-subtask-toggle]');if(subtaskToggle){toggleSubtask(subtaskToggle.dataset.subtaskToggle,subtaskToggle.dataset.parentTask);return}
    const pdf=event.target.closest('[data-invoice-pdf]');if(pdf){generateInvoicePdf(pdf.dataset.invoicePdf);return}
    const email=event.target.closest('[data-invoice-email]');if(email){invoiceEmail(email.dataset.invoiceEmail);return}
    const permissions=event.target.closest('[data-member-permissions]');if(permissions){openMemberPermissions(permissions.dataset.memberPermissions);return}
    const tab=event.target.closest('[data-settings-tab]');if(tab){settingsTab=tab.dataset.settingsTab;renderSettings();return}
    const integration=event.target.closest('[data-check-integration]');if(integration){checkIntegration(integration.dataset.checkIntegration);return}
    const configureIntegration=event.target.closest('[data-configure-integration]');if(configureIntegration){openIntegrationSetup(configureIntegration.dataset.configureIntegration);return}
    const retry=event.target.closest('[data-retry-integration]');if(retry){retryIntegration(retry.dataset.retryIntegration);return}
    const copyVariables=event.target.closest('[data-copy-integration]');if(copyVariables){const names=copyVariables.dataset.copyIntegration==='openai'?['OPENAI_API_KEY','OPENAI_ACCOUNT_LABEL','OPENAI_PROJECT_ID','OPENAI_ORGANIZATION_ID','OPENAI_ALLOWED_MODELS']:['RESEND_API_KEY','RESEND_FROM','RESEND_REPLY_TO'];navigator.clipboard.writeText(names.map(name=>name+'=').join('\n')).then(()=>app.notify('Variables copiadas'));return}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closePopovers()});
  window.addEventListener('sc:workspace',renderAll);
}

bind();
renderAll();
