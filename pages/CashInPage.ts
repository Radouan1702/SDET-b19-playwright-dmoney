import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class CashInPage extends BasePage {
  readonly customerInput = this.page.locator('input[name="customer"]');
  readonly amountInput = this.page.locator('input[name="amount"]');
  readonly cashInButton = this.page.getByRole('button', { name: /cash in/i });

  async open(): Promise<void> {
    await this.goto('/agent/cash-in');
    await expect(this.customerInput).toBeVisible();
  }

  async deposit(receiverPhone: string, amount: number): Promise<void> {
    await this.customerInput.fill(receiverPhone);
    await this.amountInput.fill(String(amount));
    await this.cashInButton.click();
  }

  async getTransactionId(): Promise<string> {
    const transactionId = this.page.getByText(/TXN[A-Z0-9]+/).first();

    try {
      await expect(transactionId).toBeVisible();
    } catch {
      throw new Error('Transaction ID did not appear after the deposit');
    }

    const text = await transactionId.textContent();
    if (text === null) {
      throw new Error('Transaction ID text was empty');
    }

    return text.trim();
  }
}
