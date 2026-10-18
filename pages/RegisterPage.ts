import { errors, expect } from '@playwright/test';
import { AgentData } from '../utils/testData';
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  async open(): Promise<void> {
    await this.goto('/');
    const entryPoint = this.page
      .getByRole('link', { name: /sign up|register/i })
      .or(this.page.getByRole('button', { name: /sign up|register/i }))
      .first();

    try {
      await entryPoint.waitFor({ state: 'visible', timeout: 3000 });
      await entryPoint.click();
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) {
        throw error;
      }
      await this.goto('/register');
    }

    await expect(this.page.locator('input[name="name"]')).toBeVisible();
  }

  async selectRole(role: 'Agent' | 'Customer' = 'Agent'): Promise<void> {
    await this.page.getByRole('combobox').click();
    await this.page.getByRole('option', { name: role }).click();
  }

  async fillForm(agent: AgentData): Promise<void> {
    await this.page.locator('input[name="name"]').fill(agent.name);
    await this.page.locator('input[name="email"]').fill(agent.email);
    await this.page.locator('input[name="password"]').fill(agent.password);
    await this.page.locator('input[name="phone_number"]').fill(agent.phone);
    await this.page.locator('input[name="nid"]').fill(agent.nid);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: /create account/i }).click();
  }

  async registerAgent(agent: AgentData): Promise<void> {
    await this.open();
    await this.selectRole('Agent');
    await this.fillForm(agent);
    await this.submit();
  }

  async expectRegistrationSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/, { timeout: 15000 });
  }
}
