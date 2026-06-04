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

test.describe('Task export with notes local verification', () => {
  test('should export notes for active and archived tasks', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    test.setTimeout(180000);

    await workViewPage.waitForTaskList();

    const taskTitle = `${testPrefix}-Export Notes Task`;
    const noteContent = `${testPrefix}-Export note line 1\n${testPrefix}-Export note line 2`;

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
    await expect(page.locator('task-detail-panel')).toContainText(`${testPrefix}-Export note line 1`);

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
    expect(activeContent).toContain(`${testPrefix}-Export note line 1`);
    expect(activeContent).toContain('- Archived: No');

    await taskPage.markTaskAsDone(task);

    const finishDayBtn = page.locator('.e2e-finish-day');
    await finishDayBtn.waitFor({ state: 'visible', timeout: 10000 });
    await finishDayBtn.click();
    await page.waitForURL(/daily-summary/, { timeout: 20000 });

    const saveBtn = page.locator(
      'daily-summary button[mat-flat-button][color="primary"]:last-of-type',
    );
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn.click();
    await page.waitForURL(/tag\/TODAY\/tasks/, { timeout: 20000 });

    await page.goto('/#/tag/TODAY/worklog');
    await page.waitForLoadState('networkidle');

    const monthTitle = page.locator('.month-title').first();
    await monthTitle.waitFor({ state: 'visible', timeout: 15000 });
    await monthTitle.click({ position: { x: 20, y: 20 } });

    const weekRow = page.locator('.week-row').first();
    await weekRow.waitFor({ state: 'visible', timeout: 15000 });
    await weekRow.click();
    await page.waitForTimeout(500);

    const archivedTaskTitle = page
      .locator('.task-title-clickable')
      .filter({ hasText: taskTitle })
      .first();
    await archivedTaskTitle.waitFor({ state: 'visible', timeout: 15000 });
    await archivedTaskTitle.click();

    const archivedDialog = page.locator('mat-dialog-container');
    await archivedDialog.waitFor({ state: 'visible', timeout: 10000 });
    await expect(archivedDialog).toContainText(`${testPrefix}-Export note line 1`);

    const archivedDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export task with notes' }).click();
    const archivedDownload = await archivedDownloadPromise;
    const archivedContent = await readDownloadedFile(archivedDownload);

    expect(archivedContent).toContain(`# ${taskTitle}`);
    expect(archivedContent).toContain('## Notes');
    expect(archivedContent).toContain(`${testPrefix}-Export note line 1`);
    expect(archivedContent).toContain('- Archived: Yes');
  });
});
