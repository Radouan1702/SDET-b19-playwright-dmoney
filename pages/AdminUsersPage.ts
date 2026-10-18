import { expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class AdminUsersPage extends BasePage {
  readonly searchTypeSelect = this.page.locator('.MuiSelect-select').first();
  readonly searchInput = this.page.getByPlaceholder('e.g., user@example.com');
  readonly searchButton = this.page.getByRole('button', { name: 'Search' });

  async open(): Promise<void> {
    await this.goto('/admin/users');
    await expect(this.searchTypeSelect).toBeVisible();
  }

  async searchByEmail(email: string): Promise<void> {
    await this.searchTypeSelect.click();
    await this.page.getByRole('option', { name: 'Search by Email' }).click();
    await this.searchInput.fill(email);
    await this.searchButton.click();
    await expect(this.getUserRow(email)).toBeVisible();
  }

  getUserRow(email: string): Locator {
    return this.page.locator('tbody tr').filter({ hasText: email });
  }

  async getStatusInList(email: string): Promise<string> {
    return (await this.getUserRow(email).locator('.MuiChip-root').first().innerText()).trim();
  }

  async openUser(email: string): Promise<void> {
    await this.getUserRow(email).getByRole('button', { name: 'View' }).click();
    await expect(this.page.getByRole('button', { name: 'Edit User' })).toBeVisible();
  }

  async activateUser(): Promise<void> {
    await this.page.getByRole('button', { name: 'Edit User' }).click();
    await this.page.locator('.MuiSelect-select').nth(1).click();
    await this.page.getByRole('option', { name: 'Active' }).click();
    const [saveResponse] = await Promise.all([
      this.page.waitForResponse(
        response =>
          ['PUT', 'PATCH', 'POST'].includes(response.request().method()) &&
          response.status() < 400,
        { timeout: 15000 },
      ),
      this.page.getByRole('button', { name: 'Save Changes' }).click(),
    ]);
    await expect(this.detailStatusChip()).toHaveText(/ACTIVE/i);
  }

  async getDetailStatus(): Promise<string> {
    return (await this.detailStatusChip().innerText()).trim();
  }

  private detailStatusChip(): Locator {
    return this.page
      .locator('.MuiChip-root')
      .filter({ hasText: /ACTIVE|PENDING|SUSPENDED/i })
      .first();
  }
}
