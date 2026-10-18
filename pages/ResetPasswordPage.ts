import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ResetPasswordPage extends BasePage {
  readonly emailInput = this.page.locator('input').first();
  readonly passwordInputs = this.page.locator('input[type="password"]');

  async openForgotPassword(): Promise<void> {
    await this.goto('/forgot-password');
    await expect(this.emailInput).toBeVisible();
  }

  async requestResetLink(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.page.getByRole('button', { name: /send reset link/i }).click();
    await expect(this.alertMessage).toContainText(/reset link has been sent/i);
  }

  async openResetLink(url: string): Promise<void> {
    await this.page.goto(url);
    await expect(this.passwordInputs.first()).toBeVisible();
  }

  async resetPassword(newPassword: string): Promise<void> {
    await this.passwordInputs.first().fill(newPassword);
    await this.passwordInputs.nth(1).fill(newPassword);
    await this.page.getByRole('button', { name: /reset password/i }).click();
  }

  async expectResetSuccess(): Promise<void> {
    await expect
      .poll(
        async () => {
          const onLogin = /\/login/.test(this.page.url());
          const msg = (await this.alertMessage.isVisible().catch(() => false))
            ? await this.alertMessage.innerText()
            : '';
          return onLogin || /reset successfully/i.test(msg);
        },
        { timeout: 15000 },
      )
      .toBe(true);
  }
}
