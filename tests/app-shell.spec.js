import { expect, test } from '@playwright/test';

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
  expect(runtimeErrors).toEqual([]);
});
