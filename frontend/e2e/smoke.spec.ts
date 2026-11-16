import { test, expect } from '@playwright/test';
import { firstEventId, noHorizontalScroll, trackErrors } from './helpers';

const STATIC_PAGES = ['/', '/events', '/login', '/register', '/forgot-password', '/contact', '/faq', '/terms', '/privacy'];

for (const path of STATIC_PAGES) {
  test(`${path} renders without errors or sideways scroll`, async ({ page }) => {
    const errors = trackErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('nav.onezone-nav')).toBeVisible();
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
}

test('event detail and seat selection pages render', async ({ page }) => {
  const id = await firstEventId();
  const errors = trackErrors(page);

  await page.goto(`/events/${id}`);
  await expect(page.locator('h1').first()).not.toBeEmpty();
  await noHorizontalScroll(page);

  await page.goto(`/events/${id}/tickets`);
  await expect(page.locator('.tsp-root, .tsp-error').first()).toBeVisible();
  await noHorizontalScroll(page);

  expect(errors).toEqual([]);
});

test('no broken images on the home page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const broken = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.src),
  );
  expect(broken).toEqual([]);
});
