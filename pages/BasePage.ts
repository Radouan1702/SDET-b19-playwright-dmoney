import { expect, Page } from '@playwright/test';

export class BasePage {
  readonly avatarButton: ReturnType<Page['locator']>;
  readonly logoutMenuItem: ReturnType<Page['getByRole']>;
  readonly alertMessage: ReturnType<Page['locator']>;
  readonly balanceField: ReturnType<Page['getByLabel']>;

  constructor(protected page: Page) {
    this.avatarButton = page.locator('header .MuiAvatar-root');
    this.logoutMenuItem = page.getByRole('menuitem', { name: /logout/i });
    this.alertMessage = page.locator('.MuiAlert-message, [role="alert"]').first();
    this.balanceField = page.getByLabel('Current Balance (BDT)');
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async clickRoleButton(name: string | RegExp): Promise<void> {
    await this.page.getByRole('button', { name }).click();
  }

  async expectText(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  async openProfile(): Promise<void> {
    await this.goto('/profile');
    await expect(this.balanceField).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.avatarButton.click();
    await this.logoutMenuItem.click();
    await expect(this.page).toHaveURL(/\/login/);
  }
}
