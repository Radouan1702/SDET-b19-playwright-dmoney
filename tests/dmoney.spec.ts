import { BrowserContext, expect, Page, test } from '@playwright/test';
import { closeSession, createSession, Session } from '../utils/session';
import { ADMIN, AgentData, generateAgentData, SYSTEM, SYSTEM_DEPOSIT_AMOUNT } from '../utils/testData';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { BasePage } from '../pages/BasePage';
import { CashInPage } from '../pages/CashInPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { SelfStatementPage } from '../pages/SelfStatementPage';
import { waitForOtp, waitForResetLink } from '../utils/gmailHelper';
import { AGENT_DEPOSIT_AMOUNT, EXISTING_CUSTOMER_PHONE } from '../utils/testData';
import { readCsv, saveCsv, selfStatementFileName } from '../utils/csvHelper';
import path from 'node:path';

// Serial suite, shared page = one video. @smoke = positive cases only; @regression = everything.
test.describe('dMoney end-to-end journey', () => {
  test.describe.configure({ mode: 'serial' });

  let session: { context: BrowserContext; page: Page };
  let page: Page;
  let agent: AgentData;
  let systemTxnId: string;
  let statementHeaders: string[];
  let statementRows: string[][];
  let csvPath: string;
  const usedOtps: string[] = [];

  test.beforeAll(async ({ browser }, testInfo) => {
    session = await createSession(browser, testInfo);
    page = session.page;
    agent = generateAgentData();
  });

  test.afterAll(async () => {
    await closeSession(session);
  });

  test('TC01 Agent registers successfully', { tag: ['@smoke', '@regression'] }, async () => {
    const register = new RegisterPage(page);
    await register.registerAgent(agent);
    await register.expectRegistrationSuccess();
  });

  test('TC02 Admin logs in successfully', { tag: ['@smoke', '@regression'] }, async () => {
    const login = new LoginPage(page);
    await login.open();
    await login.login(ADMIN.email, ADMIN.password);
    await login.expectLoggedIn();
  });

  test('TC03 Registered agent appears in the admin user list', { tag: ['@smoke', '@regression'] }, async () => {
    const adminUsers = new AdminUsersPage(page);
    await adminUsers.open();
    await adminUsers.searchByEmail(agent.email);
    await expect(adminUsers.getUserRow(agent.email)).toBeVisible();
  });

  test('TC04 Newly registered agent is initially inactive', { tag: ['@smoke', '@regression'] }, async () => {
    const adminUsers = new AdminUsersPage(page);
    await expect.poll(() => adminUsers.getStatusInList(agent.email)).toMatch(/PENDING/i);
  });

  test('TC05 Admin activates the agent', { tag: ['@smoke', '@regression'] }, async () => {
    const adminUsers = new AdminUsersPage(page);
    await adminUsers.openUser(agent.email);
    await adminUsers.activateUser();
    await expect.poll(() => adminUsers.getDetailStatus()).toMatch(/ACTIVE/i);
  });

  test('TC06 Agent stays active after page reload', { tag: ['@smoke', '@regression'] }, async () => {
    const adminUsers = new AdminUsersPage(page);
    await expect(async () => {
      await adminUsers.open();
      await adminUsers.searchByEmail(agent.email);
      await expect(adminUsers.getUserRow(agent.email).locator('.MuiChip-root')).toHaveText(/ACTIVE/i, {
        timeout: 3000,
      });
    }).toPass({ timeout: 20000 });
  });

  test('TC07 Admin logs out', { tag: ['@smoke', '@regression'] }, async () => {
    await new AdminUsersPage(page).logout();
  });

  test('TC08 System logs in successfully', { tag: ['@smoke', '@regression'] }, async () => {
    const login = new LoginPage(page);
    await login.open();
    await login.login(SYSTEM.email, SYSTEM.password);
    await login.expectOnProfile();
  });

  test('TC09 System deposits 2000 Tk to the agent', { tag: ['@smoke', '@regression'] }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.open();
    await cashIn.deposit(agent.phone, SYSTEM_DEPOSIT_AMOUNT);
    await expect(page.getByText('SYSTEM deposit to Agent successful')).toBeVisible();
  });

  test('TC10 System deposit creates the correct transaction record', { tag: ['@smoke', '@regression'] }, async () => {
    const cashIn = new CashInPage(page);
    await expect(page.getByText('TRANSACTION ID')).toBeVisible();
    await expect(page.getByText('৳ 2000.00')).toBeVisible();
    systemTxnId = await cashIn.getTransactionId();
    expect(systemTxnId).toMatch(/^TXN[A-Z0-9]+$/);
  });

  test('TC11 System logs out', { tag: ['@smoke', '@regression'] }, async () => {
    await new CashInPage(page).logout();
  });

  test('TC12 Agent logs in with OTP after activation', { tag: ['@smoke', '@regression'] }, async () => {
    test.setTimeout(120000);
    const since = Date.now() - 30000;
    const login = new LoginPage(page);
    await login.open();
    await login.login(agent.email, agent.password);
    await login.expectOtpScreen();
    const otp = await waitForOtp(agent.email, since);
    usedOtps.push(otp);
    await login.submitOtp(otp);
    await login.expectOnProfile();
  });

  test('TC13 Agent balance is exactly 2000 Tk', { tag: ['@smoke', '@regression'] }, async () => {
    const base = new BasePage(page);
    await base.openProfile();
    await expect(base.balanceField).toHaveValue('2000.00');
  });

  test('TC14 Agent deposits 500 Tk to an existing customer', { tag: ['@smoke', '@regression'] }, async () => {
    const cashIn = new CashInPage(page);
    await cashIn.open();
    await cashIn.deposit(EXISTING_CUSTOMER_PHONE, AGENT_DEPOSIT_AMOUNT);
    await expect(page.getByText(/deposit successful|cash in successful|successful/i).first()).toBeVisible();
    await expect(page.getByText('TRANSACTION ID')).toBeVisible();
    await expect(page.getByText('৳ 500.00')).toBeVisible();
  });

  test('TC15 Agent balance is updated correctly after the customer deposit', { tag: ['@smoke', '@regression'] }, async () => {
    const base = new BasePage(page);
    await base.openProfile();
    // 2000 - 500 + 12.50 commission.
    await expect(base.balanceField).toHaveValue('1512.50');
  });

  test('TC16 Agent logs out', { tag: ['@smoke', '@regression'] }, async () => {
    await new BasePage(page).logout();
  });

  test('TC17 Agent password reset works', { tag: ['@smoke', '@regression'] }, async () => {
    test.setTimeout(120000);
    const since = Date.now() - 30000;
    const reset = new ResetPasswordPage(page);
    await reset.openForgotPassword();
    await reset.requestResetLink(agent.email);
    const link = await waitForResetLink(agent.email, since);
    await reset.openResetLink(link);
    await reset.resetPassword(agent.newPassword);
    await reset.expectResetSuccess();
  });

  test('TC18 Login with the old password fails', { tag: ['@regression'] }, async () => {
    const login = new LoginPage(page);
    await login.open();
    await login.login(agent.email, agent.password);
    await expect(page).toHaveURL(/\/login/);
    await expect(login.alertMessage).toBeVisible();
    await expect(login.alertMessage).toContainText(/incorrect|invalid|failed|wrong/i);
    await expect(login.otpHeading).not.toBeVisible();
  });

  test('TC19 Login with the new password succeeds', { tag: ['@smoke', '@regression'] }, async () => {
    test.setTimeout(120000);
    const since = Date.now() - 30000;
    const login = new LoginPage(page);
    await login.open();
    await login.login(agent.email, agent.newPassword);
    await login.expectOtpScreen();
    const otp = await waitForOtp(agent.email, since, 60000, usedOtps);
    usedOtps.push(otp);
    await login.submitOtp(otp);
    await login.expectOnProfile();
  });

  test('TC20 Agent opens Self Statement and the table data is extracted', { tag: ['@smoke', '@regression'] }, async () => {
    const statement = new SelfStatementPage(page);
    await statement.open();
    statementHeaders = await statement.getHeaders();
    statementRows = await statement.getRows();
    expect(statementHeaders).toEqual(
      expect.arrayContaining([
        'Transaction ID',
        'Sender Account',
        'Receiver Account',
        'Type',
        'Debit',
        'Credit',
        'Balance',
        'Date',
      ]),
    );
    expect(statementRows.length).toBeGreaterThanOrEqual(2);
  });

  test('TC21 Self Statement contains the expected records', { tag: ['@smoke', '@regression'] }, async () => {
    const systemTopUpRow = statementRows.find(row => /Top-up from SYSTEM/i.test(row.join(' | ')));
    expect(systemTopUpRow, `rows were: ${JSON.stringify(statementRows)}`).toBeTruthy();
    if (systemTopUpRow) {
      expect(systemTopUpRow).toContain('2000.00');
    }

    const customerDepositRow = statementRows.find(row => {
      const joined = row.join(' | ');
      return /Deposit Commission/i.test(joined) || row.includes(EXISTING_CUSTOMER_PHONE);
    });
    expect(customerDepositRow, `rows were: ${JSON.stringify(statementRows)}`).toBeTruthy();
    if (customerDepositRow) {
      expect(customerDepositRow).toEqual(expect.arrayContaining(['500.00', '12.50', '1512.50']));
    }
  });

  test('TC22 Self Statement data is saved to the CSV file', { tag: ['@smoke', '@regression'] }, async () => {
    csvPath = saveCsv(path.join('output', selfStatementFileName()), statementHeaders, statementRows);
  });

  test('TC23 Saved CSV file contains the table data', { tag: ['@smoke', '@regression'] }, async () => {
    const saved = readCsv(csvPath);
    expect(path.basename(csvPath)).toMatch(/^self_statement_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(saved.headers).toEqual(statementHeaders);
    expect(saved.rows).toEqual(statementRows);
    expect(saved.rows.length).toBeGreaterThanOrEqual(2);
  });
});
