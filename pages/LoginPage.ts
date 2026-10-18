import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly identifierInput = this.page.getByPlaceholder('Enter email or phone number');
  readonly passwordInput = this.page.locator('input[type="password"]');
  readonly loginButton = this.page.getByRole('button', { name: /login/i });
  readonly otpHeading = this.page.getByText('Verify Your Identity');
  readonly otpInput = this.page.getByPlaceholder('• • • •');
  readonly verifyOtpButton = this.page.getByRole('button', { name: /verify otp/i });

  async open(): Promise<void> {
    await this.goto('/login');
    if (!/\/login/.test(this.page.url())) {
      await this.page.context().clearCookies();
      await this.page.evaluate(() => localStorage.clear());
      await this.goto('/login');
    }
    await expect(this.identifierInput).toBeVisible();
  }

  async login(identifier: string, password: string): Promise<void> {
    await this.identifierInput.fill(identifier);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectOtpScreen(): Promise<void> {
    await expect(this.otpHeading).toBeVisible({ timeout: 15000 });
  }

  async submitOtp(otp: string): Promise<void> {
    await this.otpInput.fill(otp);
    await this.verifyOtpButton.click();
  }

  async expectLoggedIn(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/, { timeout: 15000 });
  }

  async expectOnProfile(): Promise<void> {
    await expect(this.page).toHaveURL(/\/profile/, { timeout: 15000 });
  }
}
