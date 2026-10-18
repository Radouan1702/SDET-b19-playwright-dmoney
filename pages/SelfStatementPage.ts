import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

// Local date (not UTC) as YYYY-MM-DD, shifted by N days.
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export class SelfStatementPage extends BasePage {
  readonly fromDateInput: Locator;
  readonly toDateInput: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    super(page);
    this.fromDateInput = page.locator('input[type="date"]').first();
    this.toDateInput = page.locator('input[type="date"]').nth(1);
    this.tableRows = page.locator('table tbody tr');
  }

  async open(): Promise<void> {
    await this.page.goto('/agent/self-statement');
    await expect(this.fromDateInput).toBeVisible();

    // From = today, To = tomorrow (the end date does not include its own day).
    await this.fromDateInput.fill(localDate(0));
    await this.toDateInput.fill(localDate(1));

    // Wait until the real data has loaded (not just a placeholder row).
    await expect
      .poll(async () => this.tableRows.count(), { timeout: 15000 })
      .toBeGreaterThanOrEqual(2);
    await expect(
      this.tableRows.filter({ hasText: /Top-up from SYSTEM/i }),
    ).toBeVisible();
  }

  async getHeaders(): Promise<string[]> {
    const headers = await this.page.locator('table thead th').allInnerTexts();
    return headers.map((h) => h.trim());
  }

  async getRows(): Promise<string[][]> {
    return this.page.$$eval('table tbody tr', (trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) =>
          (td.textContent || '').replace(/\s+/g, ' ').trim(),
        ),
      ),
    );
  }

  async findRow(text: string | RegExp): Promise<string[] | undefined> {
    const rows = await this.getRows();
    return rows.find((cells) => {
      const joined = cells.join(' | ');
      return typeof text === 'string' ? joined.includes(text) : text.test(joined);
    });
  }
}