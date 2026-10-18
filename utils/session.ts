import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';

export interface Session {
  context: BrowserContext;
  page: Page;
}

export async function createSession(browser: Browser, testInfo: TestInfo): Promise<Session> {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1366, height: 768 },
    recordVideo: {
      dir: 'output/video',
      size: { width: 1366, height: 768 },
    },
  });
  const page = await context.newPage();
  return { context, page };
}

export async function closeSession(session: Session): Promise<void> {
  const video = session.page.video();
  await session.context.close();
  if (video) {
    const videoPath = path.resolve('output/video/dmoney-full-run.webm');
    await mkdir(path.dirname(videoPath), { recursive: true });
    await video.saveAs(videoPath);
  }
}
