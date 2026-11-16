import { test, expect } from '@playwright/test';

test.describe('mobile menu', () => {
  test.skip(({ isMobile }) => !isMobile, 'phones only');

  test('opens, closes on Escape / outside click / navigation', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.nav-menu-btn');
    const menu = page.locator('#nav-mobile-menu');

    await toggle.click();
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.mouse.click(10, 600);
    await expect(menu).toBeHidden();

    await toggle.click();
    await menu.getByRole('link').nth(2).click(); // Liên hệ / Contact
    await expect(page).toHaveURL(/\/contact$/);
    await expect(menu).toBeHidden();
  });

  test('theme and language set in the menu stick', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-menu-btn').click();
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#nav-mobile-menu .theme-toggle').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before);

    await page.locator('#nav-mobile-menu .lang-toggle').click();
    await page.locator('#nav-mobile-menu .lang-option:not(.lang-option--active)').click();
    const lang = await page.evaluate(() => localStorage.getItem('lang'));
    expect(['vi', 'en']).toContain(lang);
  });
});

test.describe('desktop nav', () => {
  test.skip(({ isMobile }) => !!isMobile, 'desktop only');

  test('shows links inline and no menu toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.onezone-nav__links')).toBeVisible();
    await expect(page.locator('.nav-menu-btn')).toBeHidden();
  });
});
