import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { type Locator, type Page } from '@playwright/test';
import { expect, test } from '../../fixtures/test.fixture';

const writeNotes = async (page: Page, notes: string): Promise<Locator> => {
  const editor = page.locator('task-detail-panel inline-markdown .cm-content').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(notes);
  return editor;
};

const exportTask = async (
  page: Page,
  task: Locator,
): Promise<{ name: string; bytes: Buffer }> => {
  await task.click({ button: 'right' });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export task with notes' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error('Export download is unavailable');
  }
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
};

test.describe('Task notes export', () => {
  test('downloads Markdown while retaining code examples as text', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    const title = `${testPrefix} Export notes`;
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title);
    await taskPage.openTaskDetail(task);
    const notes =
      'Keep this text\n\n```md\n![example](indexeddb://clipboard-images/example)\n```';
    const editor = await writeNotes(page, notes);
    await editor.blur();

    const exported = await exportTask(page, task);
    expect(exported.name).toMatch(/\.md$/);
    expect(exported.bytes.toString('utf8')).toContain(notes);
    expect(exported.bytes.toString('utf8')).toContain(`# ${title}`);
  });

  test('downloads a portable ZIP containing a pasted image', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    const title = `${testPrefix} Export image`;
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title);
    await taskPage.openTaskDetail(task);
    const editor = await writeNotes(page, 'Screenshot\n\n');
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    await editor.evaluate((element, base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const clipboardData = new DataTransfer();
      clipboardData.items.add(new File([bytes], 'screenshot.png', { type: 'image/png' }));
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
      );
    }, pngBase64);
    // The focused live-editor line shows source; blur before waiting for its preview.
    await editor.blur();
    await expect(
      page.locator('task-detail-panel inline-markdown img.cm-md-image'),
    ).toBeVisible();

    const exported = await exportTask(page, task);
    expect(exported.name).toMatch(/\.zip$/);
    const entries = unzipSync(exported.bytes);
    const markdownName = Object.keys(entries).find((name) => name.endsWith('.md'));
    expect(markdownName).toBeTruthy();
    expect(strFromU8(entries[markdownName!])).toContain('(images/image-1.png)');
    expect(Buffer.from(entries['images/image-1.png'])).toEqual(
      Buffer.from(pngBase64, 'base64'),
    );
  });

  test('exports readable notes and warns when a local image is missing', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    const title = `${testPrefix} Missing image`;
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title);
    await taskPage.openTaskDetail(task);
    const editor = await writeNotes(
      page,
      'Preserve my notes\n\n![missing](indexeddb://clipboard-images/not-present)',
    );
    await editor.blur();

    const exported = await exportTask(page, task);
    expect(exported.name).toMatch(/\.md$/);
    expect(exported.bytes.toString('utf8')).toContain('Preserve my notes');
    await expect(page.locator('snack-custom')).toContainText(
      '1 local image(s) could not be included',
    );
  });
  test('exports archived task notes together with its subtasks', async ({
    page,
    workViewPage,
    taskPage,
    testPrefix,
  }) => {
    await workViewPage.waitForTaskList();
    const title = `${testPrefix} Archived export`;
    const childTitle = `${testPrefix} Archived child`;
    await workViewPage.addTask(title);
    const task = taskPage.getTaskByText(title);
    await taskPage.openTaskDetail(task);
    const editor = await writeNotes(page, 'Archived notes remain readable');
    await editor.blur();
    await taskPage.openTaskDetail(task);
    await workViewPage.addSubTask(task, childTitle);
    await taskPage.markTaskAsDone(taskPage.getSubTasks(task).first());
    await task.locator('task-title').first().hover();
    await task.locator('done-toggle').first().click();
    await expect(page.locator('task:not(.isDone)')).toHaveCount(0);
    await page.locator('.e2e-finish-day').click();
    await expect(page.locator('daily-summary')).toBeVisible();
    await page
      .locator('daily-summary button[mat-flat-button][color="primary"]')
      .last()
      .click();
    await page.waitForURL(/#\/tag\/TODAY\/tasks/);
    await page.goto('/#/tag/TODAY/history');
    await page.locator('history .week-row .day-toggle').first().click();
    await page
      .locator('.task-summary-table tr td.title button')
      .filter({ hasText: title })
      .click();
    const dialog = page.locator('dialog-view-archived-task');
    await expect(dialog).toContainText('Archived notes remain readable');
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export task with notes' }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    const markdown = await readFile(path!, 'utf8');
    expect(markdown).toContain('Archived notes remain readable');
    expect(markdown).toContain(childTitle);
    expect(markdown).toContain('- Archived: Yes');
  });
});
