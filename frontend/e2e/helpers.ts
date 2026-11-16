import { expect, type Page } from '@playwright/test';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/** Collects uncaught page errors; assert it's empty at the end of a test. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** First event the public API lists, so tests don't depend on fixed ids. */
export async function firstEventId(): Promise<number> {
  const res = await fetch(`${API_URL}/events`);
  const events = (await res.json()) as { id: number }[];
  expect(events.length, 'the API should list at least one event').toBeGreaterThan(0);
  return events[0].id;
}

export async function setLanguage(page: Page, lang: 'vi' | 'en') {
  await page.addInitScript((l) => localStorage.setItem('lang', l), lang);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not scroll sideways').toBeLessThanOrEqual(1);
}
