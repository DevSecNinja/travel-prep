// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Travel Prep — Packing List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForSelector('#packingLists');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Travel Prep/);
  });

  test('displays both categories', async ({ page }) => {
    const categories = page.locator('.category');
    await expect(categories).toHaveCount(2);
  });

  test('displays default items', async ({ page }) => {
    const items = page.locator('.item-card');
    // 5 must-have + 2 nice-to-have = 7
    await expect(items).toHaveCount(7);
  });

  test('can check off an item', async ({ page }) => {
    const firstItem = page.locator('.item-card').first();
    await firstItem.click();
    await expect(firstItem).toHaveClass(/checked/);
  });

  test('checked item appears in suitcase', async ({ page }) => {
    const firstItem = page.locator('.item-card').first();
    await firstItem.click();
    const suitcaseItems = page.locator('.suitcase-item');
    await expect(suitcaseItems).toHaveCount(1);
  });

  test('progress updates when checking items', async ({ page }) => {
    const firstItem = page.locator('.item-card').first();
    await firstItem.click();
    const progressLabel = page.locator('#progressLabel');
    await expect(progressLabel).toContainText('1 of 7 packed');
  });

  test('can uncheck all items', async ({ page }) => {
    // Check a few items
    const items = page.locator('.item-card');
    await items.nth(0).click();
    await items.nth(1).click();

    // Click uncheck all
    await page.locator('#uncheckAllBtn').click();

    // No items should be checked
    const checked = page.locator('.item-card.checked');
    await expect(checked).toHaveCount(0);
  });

  test('can add a new item', async ({ page }) => {
    await page.fill('#newItemInput', 'sunglasses');
    await page.click('#addItemForm button[type="submit"]');

    // Should now have 8 items
    const items = page.locator('.item-card');
    await expect(items).toHaveCount(8);
  });

  test('can delete an item', async ({ page }) => {
    const firstCard = page.locator('.item-card').first();
    await firstCard.hover();
    const deleteBtn = firstCard.locator('.item-delete');
    await deleteBtn.click();

    const items = page.locator('.item-card');
    await expect(items).toHaveCount(6);
  });

  test('theme toggle cycles through modes', async ({ page }) => {
    const toggle = page.locator('#themeToggle');
    await toggle.click();
    // Should cycle from auto → light → dark or similar
    const html = page.locator('html');
    const theme = await html.getAttribute('data-theme');
    expect(['light', 'dark']).toContain(theme);
  });

  test('suitcase shows empty message initially', async ({ page }) => {
    const emptyMsg = page.locator('.suitcase-empty');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toContainText('Check off items');
  });

  test('service worker is registered', async ({ page }) => {
    // Check that the service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    });
    expect(swRegistered).toBe(true);
  });
});
