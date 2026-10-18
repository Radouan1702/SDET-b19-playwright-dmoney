import { faker } from '@faker-js/faker';

export const ADMIN = { email: 'admin@dmoney.com', password: '1234' };
export const SYSTEM = { email: 'system@dmoney.com', password: '1234' };
export const EXISTING_CUSTOMER_PHONE = '01726702638';
export const SYSTEM_DEPOSIT_AMOUNT = 2000;
export const AGENT_DEPOSIT_AMOUNT = 500;
export const EXPECTED_BALANCE_AFTER_SYSTEM_DEPOSIT = 2000;
export const EXPECTED_BALANCE_AFTER_CUSTOMER_DEPOSIT = 1512.5;

export interface AgentData {
  name: string;
  email: string;
  password: string;
  newPassword: string;
  phone: string;
  nid: string;
}

// Data is generated fresh on every run so tests are repeatable.
export function generateAgentData(): AgentData {
  const baseEmail = process.env.GMAIL_BASE_EMAIL;
  if (!baseEmail) {
    throw new Error('GMAIL_BASE_EMAIL is required to generate agent data');
  }

  const password = `Agent@${faker.string.numeric(4)}`;
  let newPassword = `Reset@${faker.string.numeric(4)}`;
  while (newPassword === password) {
    newPassword = `Reset@${faker.string.numeric(4)}`;
  }

  return {
    name: faker.person.fullName(),
    email: `${baseEmail}+agent${Date.now()}@gmail.com`,
    password,
    newPassword,
    phone: `01${faker.helpers.arrayElement(['3', '4', '5', '6', '7', '8', '9'])}${faker.string.numeric(8)}`,
    nid: faker.string.numeric(10),
  };
}
