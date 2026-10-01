import { expect, test } from '@playwright/test';
import { stat } from 'node:fs/promises';

async function enterDemo(page) {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.route('**/assets/js/config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.SC_CONFIG = {};'
  }));
  await page.goto('/');
  await page.getByRole('button', { name: /Entrar a la demo/i }).click();
  await expect(page.locator('#appShell')).toBeVisible();
  await expect(page.locator('#authShell')).toBeHidden();
  return runtimeErrors;
}

test('recorre y opera los módulos multiempresa en modo demo', async ({ page }) => {
  const runtimeErrors = await enterDemo(page);
  await expect(page.locator('#organizationSelect')).toHaveValue('demo-sc');

  await page.locator('#userPill').click();
  await expect(page.locator('#userMenu')).toBeVisible();
  await page.locator('[data-user-action="profile"]').click();
  await expect(page.locator('#actionTitle')).toHaveText('Mi perfil');
  await page.locator('#actionForm [data-close="actionModal"]').click();
  await expect(page.locator('#actionModal')).toBeHidden();

  await page.locator('[data-view="team"]').click();
  await expect(page.locator('#teamOverview')).toContainText('3');
  const alexisCard = page.locator('.team-card').filter({ hasText: 'Alexis Reyes' });
  await alexisCard.locator('[data-team-edit]').click();
  await page.locator('#actionForm [name="job_title"]').fill('Coordinación comercial');
  await page.locator('#actionForm [name="role"]').selectOption('project_manager');
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(alexisCard).toContainText('Coordinación comercial');
  await expect(alexisCard).toContainText('Responsable de proyectos');

  await page.locator('[data-view="clients"]').click();
  await page.locator('#newClientBtn').click();
  await page.locator('#actionForm [data-close="actionModal"]').click();
  await expect(page.locator('#actionModal')).toBeHidden();
  await page.locator('#newClientBtn').click();
  await page.locator('#actionForm [name="business_name"]').fill('Cliente de prueba');
  await page.locator('#actionForm [name="contact_name"]').fill('Persona Demo');
  await page.locator('#actionForm [name="city"]').fill('Concepción del Uruguay');
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.locator('#clientRows')).toContainText('Cliente de prueba');

  await page.locator('[data-view="projects"]').click();
  await page.locator('#newProjectBtn').click();
  await page.locator('#actionForm [name="name"]').fill('Implementación interna');
  await page.locator('#actionForm [name="client_id"]').selectOption({ label: 'Cliente de prueba' });
  await page.locator('#actionForm [name="status"]').selectOption('in_progress');
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.locator('#projectGrid')).toContainText('Implementación interna');

  await page.locator('[data-project-progress]').first().click();
  await page.locator('#actionForm [name="progress"]').fill('100');
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.locator('#projectGrid')).toContainText('Completado');

  await page.locator('[data-view="documents"]').click();
  await page.locator('#newDocumentBtn').click();
  await page.locator('#actionForm [name="title"]').fill('Acta de prueba');
  await page.locator('#actionForm [name="category"]').selectOption('contract');
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.locator('#documentRows')).toContainText('Acta de prueba');

  await page.locator('[data-view="billing"]').click();
  await page.locator('#newInvoiceBtn').click();
  await page.locator('#actionForm [name="client_id"]').selectOption({ label: 'Cliente de prueba' });
  await page.locator('#actionForm [name="total"]').fill('125000');
  await page.locator('#actionForm [name="status"]').selectOption('issued');
  await page.locator('#actionForm button[type="submit"]').click();
  await expect(page.locator('#invoiceRows')).toContainText('125.000');

  await page.locator('[data-view="team"]').click();
  await expect(page.locator('#teamGrid')).toContainText('Maikol Betancourt');
  expect(runtimeErrors).toEqual([]);
});

test('opera colaboración, comunicaciones, PDF y configuración', async ({ page }) => {
  const runtimeErrors = await enterDemo(page);

  await page.locator('#quickCreateBtn').click();
  await expect(page.locator('#quickCreateMenu')).toBeVisible();
  await expect(page.locator('#quickCreateMenu')).toContainText('Tarea');
  await page.keyboard.press('Escape');

  await page.locator('[data-view="tasks"]').click();
  await page.locator('[data-task-open]').first().click();
  await expect(page.locator('#actionEyebrow')).toHaveText('DETALLE DE TAREA');
  await page.locator('#taskChecklistForm input[name="label"]').fill('Validar entrega con el cliente');
  await page.locator('#taskChecklistForm button[type="submit"]').click();
  await expect(page.locator('.checklist-list')).toContainText('Validar entrega con el cliente');
  const checklistRow=page.locator('.checklist-row').filter({hasText:'Validar entrega con el cliente'});
  await checklistRow.locator('[data-checklist-toggle]').click();
  await expect(page.locator('.checklist-row').filter({hasText:'Validar entrega con el cliente'})).toHaveClass(/is-done/);

  await page.locator('#taskSubtaskForm input[name="title"]').fill('Preparar evidencia de cierre');
  await page.locator('#taskSubtaskForm button[type="submit"]').click();
  await expect(page.locator('.subtask-list')).toContainText('Preparar evidencia de cierre');

  await page.locator('#taskCommentForm textarea').fill('Actualización de prueba para @areyes');
  await page.locator('#taskCommentForm button[type="submit"]').click();
  await expect(page.locator('.comment-list')).toContainText('Actualización de prueba');
  await page.locator('#actionModal [data-close="actionModal"]').click();

  await page.locator('[data-view="billing"]').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-invoice-pdf]').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  await page.locator('[data-view="communications"]').click();
  await page.locator('#composeEmailBtn').click();
  await page.locator('#emailComposerForm [name="to"]').fill('cliente@demo.local');
  await page.locator('#emailComposerForm [name="subject"]').fill('Seguimiento de prueba');
  await page.locator('#emailComposerForm [name="body"]').fill('Mensaje trazable de prueba.');
  await page.locator('#emailComposerForm button[value="draft"]').click();
  await expect(page.locator('#emailRows')).toContainText('Seguimiento de prueba');

  await page.locator('[data-view="settings"]').click();
  await expect(page.locator('#settingsSurface')).toContainText('Identidad de la empresa');
  await page.locator('[data-settings-tab="notifications"]').click();
  await expect(page.locator('#settingsSurface')).toContainText('Preferencias personales');

  await page.locator('[data-settings-tab="integrations"]').click();
  await expect(page.locator('#settingsSurface')).toContainText('ChatGPT para agentes');
  const tabsOverflow=await page.locator('.settings-tabs').evaluate(element=>({
    clientHeight:element.clientHeight,
    scrollHeight:element.scrollHeight,
    overflowY:getComputedStyle(element).overflowY
  }));
  expect(tabsOverflow.scrollHeight).toBeLessThanOrEqual(tabsOverflow.clientHeight+1);
  expect(['clip','hidden']).toContain(tabsOverflow.overflowY);
  await page.locator('[data-configure-integration="chatgpt"]').click();
  await expect(page.locator('#actionTitle')).toHaveText('Conectar con ChatGPT');
  await expect(page.locator('#actionBody')).toContainText('Inicio de sesión oficial, sin claves manuales');
  await expect(page.locator('#actionBody')).toContainText('Maikol Betancourt');
  await expect(page.locator('#actionBody')).not.toContainText('OPENAI_API_KEY');
  await page.locator('#actionModal [data-close="actionModal"]').click();

  const topbarHeight=await page.locator('.topbar').evaluate(element=>element.getBoundingClientRect().height);
  expect(topbarHeight).toBeLessThanOrEqual(66);

  expect(runtimeErrors).toEqual([]);
});

test('mantiene navegación usable y sin desborde horizontal en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeErrors = await enterDemo(page);
  await page.locator('#menuBtn').click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#sidebarBackdrop')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/sidebar-open/);

  const mobileSidebar = await page.locator('#sidebar').boundingBox();
  expect(mobileSidebar).not.toBeNull();
  expect(mobileSidebar.width).toBeLessThanOrEqual(321);
  expect(mobileSidebar.width).toBeGreaterThanOrEqual(280);
  expect(Math.abs(mobileSidebar.height - 844)).toBeLessThanOrEqual(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#menuBtn')).toBeFocused();

  await page.locator('#menuBtn').click();
  await page.locator('#sidebar [data-view="projects"]').click();
  await expect(page.locator('#projectsView')).toBeVisible();
  await expect(page.locator('#sidebarBackdrop')).toBeHidden();

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator('#menuBtn').click();
  const tabletSidebar = await page.locator('#sidebar').boundingBox();
  expect(tabletSidebar).not.toBeNull();
  expect(tabletSidebar.width).toBeLessThanOrEqual(321);
  expect(Math.abs(tabletSidebar.height - 1024)).toBeLessThanOrEqual(1);
  await page.locator('#sidebarCloseBtn').click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  const mobileTopbarHeight=await page.locator('.topbar').evaluate(element=>element.getBoundingClientRect().height);
  expect(mobileTopbarHeight).toBeLessThanOrEqual(60);
  expect(runtimeErrors).toEqual([]);
});

test('crea, calcula, versiona y exporta presupuestos por etapas', async ({ page }) => {
  const runtimeErrors = await enterDemo(page);
  await page.locator('[data-view="budgets"]').click();
  await expect(page.locator('#budgetsView')).toBeVisible();
  await expect(page.locator('#budgetRows')).toContainText('PRE-2026-0001');

  await page.locator('#newBudgetBtn').click();
  await expect(page.locator('#budgetModal')).toBeVisible();
  await page.locator('[data-header="title"]').fill('Automatización de pedidos y reportes');
  await page.locator('[data-header="project_name"]').fill('Operación comercial conectada');
  await page.locator('[data-item-field="description"]').first().fill('Relevamiento e implementación');
  await page.locator('[data-item-field="quantity"]').first().fill('2');
  await page.locator('[data-item-field="unit_cost"]').first().fill('1000');
  await page.locator('[data-item-field="margin_percent"]').first().fill('25');
  await page.locator('[data-header="tax_percent"]').fill('21');
  await expect(page.locator('#quoteTotal')).toContainText('3.025');
  await page.locator('#budgetForm button[type="submit"]').click();
  await expect(page.locator('#budgetModal')).toBeHidden();
  const createdRow=page.locator('#budgetRows tr').filter({hasText:'Operación comercial conectada'});
  await expect(createdRow).toContainText('3.025');

  const downloadPromise=page.waitForEvent('download');
  await createdRow.locator('[data-quote-pdf]').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^PRE-\d{4}-\d{4}-v1\.pdf$/);

  await createdRow.locator('[data-quote-version]').click();
  await expect(page.locator('[data-header="status"]')).toHaveValue('borrador');
  await expect(page.locator('.quote-version-chip')).toContainText('v2');
  await page.locator('[data-close="budgetModal"]').last().click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#newBudgetBtn').click();
  const mobileModal = await page.locator('.budget-modal').boundingBox();
  expect(mobileModal).not.toBeNull();
  expect(mobileModal.x).toBeGreaterThanOrEqual(0);
  expect(mobileModal.width).toBeLessThanOrEqual(390);
  expect(mobileModal.height).toBeLessThanOrEqual(845);
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  await page.locator('#budgetBuilder').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('.quote-form-actions')).toBeVisible();
  await page.locator('[data-close="budgetModal"]').last().click();
  expect(runtimeErrors).toEqual([]);
});

test('crea una propuesta conceptual con portada, módulos y PDF profesional', async ({ page }) => {
  const runtimeErrors = await enterDemo(page);
  await page.locator('[data-view="budgets"]').click();
  await page.locator('#newBudgetBtn').click();
  await page.locator('[data-header="proposal_type"]').selectOption('conceptual');

  await expect(page.locator('#budgetModalTitle')).toContainText('propuesta conceptual');
  await expect(page.locator('[data-header="pricing_display"]')).toHaveValue('section_total');
  await expect(page.locator('[data-header="cover_enabled"]')).toBeChecked();
  await expect(page.locator('[data-header="executive_summary"]')).toBeVisible();
  await page.locator('[data-header="title"]').fill('Gestión administrativa y documental conectada');
  await page.locator('[data-header="project_name"]').fill('Administración integral SC');
  await page.locator('[data-header="cover_subtitle"]').fill('Una operación ordenada, trazable y preparada para crecer');
  await page.locator('[data-header="executive_summary"]').fill('La propuesta centraliza la información administrativa y reduce tareas manuales con un recorrido claro para cada responsable.');
  await page.locator('[data-header="objective"]').fill('Unificar documentación, seguimiento y reportes en una única operación controlada.');
  await page.locator('[data-section-field="title"]').first().fill('Gestión documental');
  await page.locator('[data-section-field="description"]').first().fill('Centralización de documentos, vencimientos y responsables.');
  await page.locator('[data-item-field="description"]').first().fill('Repositorio y circuito de aprobación');
  await page.locator('[data-item-field="notes"]').first().fill('Carga ordenada por cliente\nAlertas de vencimiento\nHistorial de aprobaciones');
  await page.locator('[data-item-field="quantity"]').first().fill('1');
  await page.locator('[data-item-field="unit_cost"]').first().fill('250000');
  await page.locator('[data-item-field="margin_percent"]').first().fill('20');
  await page.locator('#budgetForm button[type="submit"]').click();
  await expect(page.locator('#budgetModal')).toBeHidden();

  const createdRow=page.locator('#budgetRows tr').filter({hasText:'Administración integral SC'});
  await expect(createdRow).toContainText('Propuesta conceptual');
  const downloadPromise=page.waitForEvent('download');
  await createdRow.locator('[data-quote-pdf]').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^PRE-\d{4}-\d{4}-v1\.pdf$/);
  const downloadPath=await download.path();
  expect(downloadPath).not.toBeNull();
  expect((await stat(downloadPath)).size).toBeGreaterThan(10000);

  await page.setViewportSize({width:390,height:844});
  const mobileCard=page.locator('#mobileBudgets .budget-mobile-card').filter({hasText:'Administración integral SC'});
  await mobileCard.locator('[data-quote-edit]').click();
  await expect(page.locator('[data-header="executive_summary"]')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.locator('[data-close="budgetModal"]').last().click();
  expect(runtimeErrors).toEqual([]);
});

test('filtra un pipeline extenso y aplica los valores comerciales de la empresa', async ({ page }) => {
  const runtimeErrors = await enterDemo(page);

  await page.locator('[data-view="pipeline"]').click();
  await expect(page.locator('#pipelineView')).toBeVisible();
  await expect(page.locator('#pipelineResultCount')).toContainText(/oportunidades/);
  const visibleCards = await page.locator('.lead-card').count();
  expect(visibleCards).toBeGreaterThan(0);
  const listOverflow = await page.locator('.kanban-list').first().evaluate(element => ({
    maxHeight: getComputedStyle(element).maxHeight,
    overflowY: getComputedStyle(element).overflowY
  }));
  expect(listOverflow.maxHeight).not.toBe('none');
  expect(listOverflow.overflowY).toBe('auto');

  await page.locator('#pipelineSearch').fill('__sin_resultados__');
  await expect(page.locator('.pipeline-empty')).toBeVisible();
  await expect(page.locator('#pipelineResultCount')).toHaveText(/^0 de \d+ oportunidades$/);
  await page.locator('#pipelineClearFilters').click();
  await expect(page.locator('.lead-card').first()).toBeVisible();

  await page.locator('#pipelineHideEmpty').check();
  const populatedColumns = await page.locator('.kanban-col').evaluateAll(columns => columns.every(column => column.querySelectorAll('.lead-card').length > 0));
  expect(populatedColumns).toBe(true);

  await page.locator('[data-view="settings"]').click();
  await page.locator('[data-settings-tab="commercial"]').click();
  await expect(page.locator('#settingsSurface')).toContainText('Pipeline comercial');
  const form = page.locator('#commercialSettingsForm');
  await form.locator('[name="pipeline_card_limit"]').selectOption('10');
  await form.locator('[name="pipeline_stale_days"]').fill('21');
  await form.locator('.settings-switch-row').click();
  await expect(form.locator('[name="pipeline_hide_empty"]')).toBeChecked();
  await form.locator('[name="quote_document_prefix"]').fill('COT');
  await form.locator('[name="quote_validity_days"]').selectOption('30');
  await form.locator('[name="quote_tax_percent"]').fill('21');
  await form.locator('[name="quote_margin_percent"]').fill('35');
  await form.locator('[name="quote_delivery_weeks"]').fill('6');
  await form.locator('[name="quote_payment_terms"]').fill('40% al inicio y saldo contra entrega');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Configuración comercial guardada');

  await page.locator('[data-view="pipeline"]').click();
  await expect(page.locator('#pipelineLimitFilter')).toHaveValue('10');
  await expect(page.locator('#pipelineHideEmpty')).toBeChecked();

  await page.locator('[data-view="budgets"]').click();
  await page.locator('#newBudgetBtn').click();
  await expect(page.locator('[data-header="document_code"]')).toHaveValue(/^COT-\d{4}-0001$/);
  await expect(page.locator('[data-header="tax_percent"]')).toHaveValue('21');
  await expect(page.locator('[data-header="delivery_weeks"]')).toHaveValue('6');
  await expect(page.locator('[data-header="payment_terms"]')).toHaveValue('40% al inicio y saldo contra entrega');
  await expect(page.locator('[data-item-field="margin_percent"]').first()).toHaveValue('35');
  const validityDays = await page.evaluate(() => {
    const issue = document.querySelector('[data-header="issue_date"]').value;
    const validUntil = document.querySelector('[data-header="valid_until"]').value;
    return Math.round((new Date(validUntil + 'T12:00:00') - new Date(issue + 'T12:00:00')) / 86400000);
  });
  expect(validityDays).toBe(30);
  await page.locator('[data-close="budgetModal"]').last().click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#menuBtn').click();
  await page.locator('#sidebar [data-view="pipeline"]').click();
  const documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(documentOverflow).toBeLessThanOrEqual(1);
  await expect(page.locator('.pipeline-filters')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('convierte una propuesta aceptada en cliente, proyecto y tareas con trazabilidad', async ({ page }) => {
  const runtimeErrors = await enterDemo(page);

  await page.locator('[data-view="pipeline"]').click();
  await expect(page.locator('#pipelineInsights article')).toHaveCount(4);
  await expect(page.locator('.lead-card-value').first()).toBeVisible();
  await expect(page.locator('.probability-pill').first()).toContainText('%');

  await page.evaluate(() => {
    const quote=window.SC_APP.data.proposals[0];
    const lead=window.SC_APP.data.prospects.find(item=>item.id===quote.prospect_id);
    quote.status='aceptada';quote.converted_client_id=null;quote.converted_project_id=null;quote.converted_at=null;
    lead.status='Negociación';lead.probability=85;lead.stage_entered_at=new Date().toISOString();
    window.SC_APP.saveDemo();
  });

  await page.locator('[data-view="budgets"]').click();
  const quoteRow=page.locator('#budgetRows tr').filter({hasText:'PRE-2026-0001'});
  await quoteRow.locator('[data-convert]').click();
  await expect(page.locator('#conversionModal')).toBeVisible();
  await expect(page.locator('.conversion-progress .active')).toContainText('Revisar');

  await page.setViewportSize({width:390,height:844});
  const conversionOverflow=await page.locator('.conversion-modal').evaluate(element=>element.scrollWidth-element.clientWidth);
  const documentOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(conversionOverflow).toBeLessThanOrEqual(1);
  expect(documentOverflow).toBeLessThanOrEqual(1);
  await page.setViewportSize({width:1280,height:900});

  await page.locator('[data-conversion-next]').click();

  const form=page.locator('#conversionForm');
  await expect(form.locator('[name="business_name"]')).toHaveValue('Taller Ruta · Demo');
  await expect(form.locator('[name="create_project"]')).toBeChecked();
  await expect(form.locator('[name="initial_task"]')).toHaveCount(3);
  await page.locator('[data-conversion-next]').click();
  await expect(page.locator('.confirmation-step')).toContainText('Digitalización del taller');
  await page.locator('[data-conversion-finish]').click();
  await expect(page.locator('#conversionModal')).toBeHidden();

  await page.locator('[data-view="clients"]').click();
  await expect(page.locator('#clientRows')).toContainText('Taller Ruta · Demo');
  await page.locator('[data-view="projects"]').click();
  await expect(page.locator('#projectGrid')).toContainText('Digitalización del taller');
  await page.locator('[data-view="tasks"]').click();
  await expect(page.locator('#taskBoard')).toContainText('Coordinar reunión de inicio');
  await page.locator('[data-view="pipeline"]').click();
  await page.locator('#pipelineOutcomeFilter').selectOption('won');
  await expect(page.locator('.lead-card').filter({hasText:'Taller Ruta · Demo'})).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('guarda vistas personales y consolida clientes desde la ficha 360', async ({ page }) => {
  const runtimeErrors = await enterDemo(page);

  await page.locator('[data-view="pipeline"]').click();
  await page.locator('#pipelineSearch').fill('Taller');
  await page.locator('#pipelineHideEmpty').check();
  await page.locator('#pipelineSaveViewBtn').click();
  await expect(page.locator('#actionTitle')).toHaveText('Guardar vista');
  await page.locator('#pipelineViewForm [name="name"]').fill('Seguimiento prioritario');
  await page.locator('#pipelineViewForm [name="is_default"]').check();
  await page.locator('#pipelineViewForm button[type="submit"]').click();
  await expect(page.locator('#pipelineSavedViewSelect')).toHaveValue(/.+/);

  await page.locator('#pipelineClearFilters').click();
  await expect(page.locator('#pipelineSearch')).toHaveValue('');
  await page.locator('#pipelineSavedViewSelect').selectOption({index:1});
  await expect(page.locator('#pipelineSearch')).toHaveValue('Taller');
  await expect(page.locator('#pipelineHideEmpty')).toBeChecked();

  await page.evaluate(() => {
    const app=window.SC_APP,now=new Date().toISOString();
    app.data.clients.push({
      id:'demo-client-duplicate',organization_id:'demo-sc',business_name:'Distribuidora Norte Demo',
      contact_name:'Marina',email:'marina@demo.local',phone:'3442000001',city:'Cdelu',status:'active',created_at:now,updated_at:now
    });
    app.data.projects.push({id:'demo-project-duplicate',organization_id:'demo-sc',client_id:'demo-client-duplicate',name:'Proyecto duplicado',status:'planned',progress:10,created_at:now,updated_at:now});
    app.data.documents.push({id:'demo-document-duplicate',organization_id:'demo-sc',client_id:'demo-client-duplicate',title:'Documento duplicado',category:'other',status:'draft',created_at:now,updated_at:now});
    app.data.invoices.push({id:'demo-invoice-duplicate',organization_id:'demo-sc',client_id:'demo-client-duplicate',internal_number:'INT-DUP',currency:'ARS',total:15000,status:'draft',created_at:now});
    app.data.emailMessages.push({id:'demo-email-duplicate',organization_id:'demo-sc',related_type:'client',related_id:'demo-client-duplicate',subject:'Correo duplicado',status:'draft',created_at:now});
    app.saveDemo();
  });

  await page.locator('[data-view="clients"]').click();
  await expect(page.locator('#clientInsights article')).toHaveCount(4);
  await page.locator('#clientSearch').fill('Distribuidora Norte Demo');
  const duplicateRow=page.locator('#clientRows tr').filter({hasText:'Distribuidora Norte Demo'});
  await duplicateRow.locator('[data-client-open]').click();
  await expect(page.locator('#client360Title')).toHaveText('Distribuidora Norte Demo');
  await expect(page.locator('.client-timeline')).toContainText('Proyecto duplicado');
  await expect(page.locator('.client360-kpis')).toContainText('15.000');

  await page.setViewportSize({width:390,height:844});
  const mobileModal=await page.locator('.client360-modal').boundingBox();
  expect(mobileModal).not.toBeNull();
  expect(mobileModal.x).toBeGreaterThanOrEqual(0);
  expect(mobileModal.width).toBeLessThanOrEqual(390);
  const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  await page.setViewportSize({width:1280,height:900});

  await page.locator('[data-client-merge]').click();
  await expect(page.locator('#client360Title')).toHaveText('Consolidar clientes');
  await page.locator('#mergeTargetSelect').selectOption('demo-client');
  await page.locator('#mergeConfirm').check();
  await page.locator('#mergeClientsBtn').click();
  await expect(page.locator('#client360Title')).toHaveText('Distribuidora Norte · Demo');
  await expect(page.locator('#client360Body')).toContainText('Distribuidora Norte Demo');
  await page.locator('[data-close="client360Modal"]').click();
  await page.locator('#clientSearch').fill('');
  await expect(page.locator('#clientRows')).not.toContainText('Distribuidora Norte Demo');

  const merged=await page.evaluate(() => {
    const app=window.SC_APP;
    return {
      source:app.data.clients.find(item=>item.id==='demo-client-duplicate'),
      projectClient:app.data.projects.find(item=>item.id==='demo-project-duplicate')?.client_id,
      documentClient:app.data.documents.find(item=>item.id==='demo-document-duplicate')?.client_id,
      invoiceClient:app.data.invoices.find(item=>item.id==='demo-invoice-duplicate')?.client_id,
      emailClient:app.data.emailMessages.find(item=>item.id==='demo-email-duplicate')?.related_id
    };
  });
  expect(merged.source.status).toBe('inactive');
  expect(merged.source.merged_into_id).toBe('demo-client');
  expect(merged.projectClient).toBe('demo-client');
  expect(merged.documentClient).toBe('demo-client');
  expect(merged.invoiceClient).toBe('demo-client');
  expect(merged.emailClient).toBe('demo-client');
  expect(runtimeErrors).toEqual([]);
});

test('mantiene Agent Studio completo y desplazable en pantallas bajas', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.route('**/assets/js/config.js', route => route.fulfill({contentType:'application/javascript',body:'window.SC_CONFIG = {};'}));
  await page.goto('/agents.html');
  await page.evaluate(()=>{
    const modal=document.querySelector('#agentStudioModal');
    modal.hidden=false;
    document.body.classList.add('studio-open');
    document.querySelector('#studioEditor').innerHTML='<form class="agent-definition-form"><section class="studio-connection is-pending"><span class="studio-connection-icon"></span><div><b>ChatGPT requiere conexión</b><p>Cuenta pendiente</p></div><a class="btn btn-secondary">Conectar</a></section><div class="studio-fields"><label>Nombre<input value="Agente Comercial"></label><label>Identificador<input value="prospecting"></label><label class="full">Descripción<input value="Demo"></label><label class="full">Prompt<textarea rows="16">Prompt de prueba</textarea></label><label>Modelo<select><option>gpt-5-mini</option></select></label></div><div class="studio-options"><fieldset><legend>Herramientas</legend><label>Web</label></fieldset><fieldset><legend>Fuentes</legend><label>CRM</label></fieldset></div><div class="studio-history"><div><b>Versiones</b></div><div class="version-list"><span>v1</span></div></div><div class="form-actions"><button class="btn btn-secondary">Cancelar</button><button class="btn btn-primary">Publicar versión</button></div></form>';
  });
  const modal=page.locator('.agent-studio-modal');
  const modalBox=await modal.boundingBox();
  expect(modalBox).not.toBeNull();
  expect(modalBox.y).toBeGreaterThanOrEqual(0);
  expect(modalBox.y+modalBox.height).toBeLessThanOrEqual(768);
  await page.locator('#studioEditor').evaluate(element=>{element.scrollTop=element.scrollHeight});
  await expect(page.locator('#studioEditor .form-actions')).toBeVisible();
  const actionsBox=await page.locator('#studioEditor .form-actions').boundingBox();
  expect(actionsBox.y+actionsBox.height).toBeLessThanOrEqual(768);
});

test('ofrece una salida clara para rutas inexistentes', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page).toHaveTitle(/Página no encontrada/);
  await expect(page.getByRole('heading', { name: /Esta dirección no pertenece/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', './');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
