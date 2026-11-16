import { test, expect } from '@playwright/test';
import { firstEventId, setLanguage, trackErrors } from './helpers';

// Words only the Vietnamese UI uses; seeing them in English mode means a
// string bypassed lib/i18n.ts. (Event names and venues are data and can be
// Vietnamese, so this checks UI words, not every accented letter.)
const VI_UI_WORDS = ['Đang tải', 'Quay lại', 'Thanh toán', 'Chọn ghế', 'Số lượng', 'Đăng nhập', 'Không thể'];

test.describe('English mode', () => {
  test.beforeEach(async ({ page }) => setLanguage(page, 'en'));

  for (const path of ['/forgot-password', '/checkout/vnpay-return', '/checkout/momo-return', '/checkout/bulk']) {
    test(`${path} has no Vietnamese UI text or unfilled placeholders`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const text = await page.locator('main').last().innerText();
      expect(text).not.toMatch(/\{\w+\}/);
      for (const w of VI_UI_WORDS) expect(text, `found "${w}"`).not.toContain(w);
      expect(errors).toEqual([]);
    });
  }

  test('seat selection page is translated', async ({ page }) => {
    const id = await firstEventId();
    await page.goto(`/events/${id}/tickets`);
    await page.waitForLoadState('networkidle');
    const text = await page.locator('main').last().innerText();
    expect(text).not.toMatch(/\{\w+\}/);
    for (const w of VI_UI_WORDS) expect(text, `found "${w}"`).not.toContain(w);
  });
});

test.describe('SEO', () => {
  test.skip(({ isMobile }) => !!isMobile, 'markup is the same on every device');

  test('event page HTML carries title, Open Graph and JSON-LD before any JS runs', async ({ request }) => {
    const id = await firstEventId();
    const html = await (await request.get(`/events/${id}`, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } })).text();
    expect(html).toMatch(/<title>[^<]+\| Vietix<\/title>/);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('"@type":"Event"');
  });

  test('robots.txt and sitemap.xml are served', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('<loc>');
  });
});
