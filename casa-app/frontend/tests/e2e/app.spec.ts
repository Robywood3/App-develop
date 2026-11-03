import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Nome').fill('admin');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? 'e2e-password');
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('heading', { name: 'Casa' })).toBeVisible();
}

test('login, live state and setpoint command with confirmation', async ({ page }) => {
  await login(page);
  const target = page.locator('.control', { hasText: 'Target piano terra' });
  const before = await target.locator('.num').textContent();
  await target.getByRole('button', { name: /Aumenta/ }).click();
  await expect(target.locator('.num')).not.toHaveText(before ?? '', { timeout: 5000 });
  await expect(target.getByText('In invio…')).toHaveCount(0);
});

test('switch toggles and the command log records the user', async ({ page }) => {
  await login(page);
  const vmc = page.getByRole('switch', { name: 'VMC primo piano' });
  const was = await vmc.getAttribute('aria-checked');
  await vmc.click();
  await expect(vmc).toHaveAttribute('aria-checked', was === 'true' ? 'false' : 'true');
  await page.goto('/#/registro');
  await expect(page.locator('td', { hasText: 'vmc.1p' }).first()).toBeVisible();
  await expect(page.locator('td', { hasText: 'admin' }).first()).toBeVisible();
});

test('every view opens without horizontal scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  for (const v of ['casa', 'impianto', 'energia', 'statistiche', '3d', 'telecamere', 'auto', 'registro']) {
    await page.goto(`/#/${v}`);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow in ${v}`).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test('keyboard shortcuts switch views', async ({ page }, info) => {
  test.skip(info.project.name !== 'tv', 'TV only');
  await login(page);
  await page.keyboard.press('2');
  await expect(page.getByRole('heading', { name: 'Impianto' })).toBeVisible();
  await page.keyboard.press('4');
  await expect(page.getByRole('heading', { name: 'Statistiche' })).toBeVisible();
});
