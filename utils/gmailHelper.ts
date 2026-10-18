interface GmailMessageSummary {
  id: string;
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

export interface ReadMessage {
  id: string;
  subject: string;
  internalDate: number;
  bodyText: string;
}

const API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getToken(): string {
  const token = process.env.GMAIL_ACCESS_TOKEN;
  if (!token) throw new Error('GMAIL_ACCESS_TOKEN is required to access Gmail');
  return token;
}

async function gmailFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (response.status === 401) {
    throw new Error('Gmail access token expired - generate a new one in OAuth Playground and update .env');
  }
  if (!response.ok) throw new Error(`Gmail API request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBody(part: GmailMessagePart): { plain?: string; html?: string } {
  const text = part.body?.data ? decodeBase64Url(part.body.data) : '';
  let result: { plain?: string; html?: string } = {};
  if (part.mimeType === 'text/plain' && text) result.plain = text;
  if (part.mimeType === 'text/html' && text) result.html = text;
  for (const child of part.parts || []) {
    const childResult = extractBody(child);
    result = { plain: result.plain || childResult.plain, html: result.html || childResult.html };
  }
  return result;
}

export async function listMessages(query: string, maxResults = 5): Promise<string[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const result = await gmailFetch<{ messages?: GmailMessageSummary[] }>(`${API_URL}/messages?${params}`);
  return (result.messages || []).map((message) => message.id);
}

export async function readMessage(id: string): Promise<ReadMessage> {
  const message = await gmailFetch<GmailMessage>(`${API_URL}/messages/${encodeURIComponent(id)}?format=full`);
  const headers = message.payload?.headers || [];
  const subject = headers.find((header) => header.name?.toLowerCase() === 'subject')?.value || '';
  const payload = message.payload;
  const rootBody = payload?.body?.data ? { plain: decodeBase64Url(payload.body.data) } : {};
  const partsBody = payload?.parts?.reduce((body, part) => {
    const partBody = extractBody(part);
    return { plain: body.plain || partBody.plain, html: body.html || partBody.html };
  }, {} as { plain?: string; html?: string }) || {};
  const bodyText = rootBody.plain || partsBody.plain || (partsBody.html ? stripHtml(partsBody.html) : '');
  return {
    id: message.id,
    subject,
    internalDate: Number(message.internalDate || 0),
    bodyText,
  };
}

function findOtp(subject: string, body: string): string | undefined {
  const text = `${subject}\n${body}`;
  const nearby = text.match(/OTP[\s:=-]*(\d{4})/i) || text.match(/(\d{4})[\s:=-]*OTP/i);
  return nearby?.[1] || text.match(/\b\d{4}\b/)?.[0];
}

export async function waitForOtp(
  toEmail: string,
  sinceMs: number,
  timeoutMs = 60000,
  excludeCodes: string[] = [],
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  do {
    const ids = await listMessages(`to:${toEmail} newer_than:1d`);
    for (const id of ids) {
      const message = await readMessage(id);
      if (message.internalDate >= sinceMs && /OTP/i.test(`${message.subject} ${message.bodyText}`)) {
        const code = findOtp(message.subject, message.bodyText);
        if (code && !excludeCodes.includes(code)) {
          console.log(`${message.subject} - OTP found`);
          return code;
        }
      }
    }
    if (Date.now() < deadline) await sleep(3000);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for OTP email to ${toEmail}; check Spam.`);
}

export async function waitForResetLink(toEmail: string, sinceMs: number, timeoutMs = 60000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  do {
    const ids = await listMessages(`to:${toEmail} newer_than:1d`);
    for (const id of ids) {
      const message = await readMessage(id);
      if (message.internalDate >= sinceMs && /Password Reset/i.test(`${message.subject} ${message.bodyText}`)) {
        const text = `${message.subject}\n${message.bodyText}`.replace(/&amp;/g, '&');
        const match = text.match(/https?:\/\/[^\s"'<>]+reset-password\?token=[^\s"'<>]+/i);
        if (match) {
          console.log(`${message.subject} - link found`);
          return match[0];
        }
      }
    }
    if (Date.now() < deadline) await sleep(3000);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for password reset email to ${toEmail}; check Spam.`);
}
