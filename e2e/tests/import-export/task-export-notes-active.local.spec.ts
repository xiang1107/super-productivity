import fs from 'fs';
import { type Download } from '@playwright/test';
import { expect, test } from '../../fixtures/test.fixture';

const readDownloadedFile = async (download: Download): Promise<string> => {
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error('Download path is null');
  }
  return fs.readFileSync(downloadPath, 'utf-8');
};

test.describe('Task export active local verification', () => {
  test('should export a task with its notes from the context menu', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    test.setTimeout(120000);

    await workViewPage.waitForTaskList();

    const taskTitle = `${testPrefix}-Active Export Task`;
    const noteContent = `${testPrefix}-Active note line 1\n${testPrefix}-Active note line 2`;

    await workViewPage.addTask(taskTitle);
    const task = taskPage.getTaskByText(taskTitle);
    await expect(task).toBeVisible({ timeout: 15000 });

    await taskPage.openTaskDetail(task);

    const markdownPreview = page.locator('task-detail-panel inline-markdown .markdown-parsed');
    await markdownPreview.waitFor({ state: 'visible', timeout: 10000 });
    await markdownPreview.click();

    const markdownTextarea = page.locator('task-detail-panel inline-markdown textarea');
    await markdownTextarea.waitFor({ state: 'visible', timeout: 10000 });
    await markdownTextarea.fill(noteContent);
    await markdownTextarea.press('Tab');

    const activeDownloadPromise = page.waitForEvent('download');
    await task.click({ button: 'right' });
    await page
      .locator('.mat-mdc-menu-content button')
      .filter({ hasText: 'Export task with notes' })
      .click();
    const activeDownload = await activeDownloadPromise;
    const activeContent = await readDownloadedFile(activeDownload);

    expect(activeContent).toContain(`# ${taskTitle}`);
    expect(activeContent).toContain('## Notes');
    expect(activeContent).toContain(`${testPrefix}-Active note line 1`);
    expect(activeContent).toContain(`${testPrefix}-Active note line 2`);
    expect(activeContent).toContain('- Archived: No');
  });
});
