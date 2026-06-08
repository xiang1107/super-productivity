import { Task } from './task.model';
import { strFromU8, unzipSync } from 'fflate';
import {
  createTaskExportZipBlob,
  exportTaskAsMarkdown,
  extractMarkdownImageRefs,
  getTaskExportFileName,
  rewriteMarkdownImageUrls,
} from './task-export.util';

describe('task-export.util', () => {
  const createTask = (overrides: Partial<Task> = {}): Task =>
    ({
      id: 'T1',
      title: 'Plan release / notes',
      subTaskIds: [],
      timeSpentOnDay: {},
      timeSpent: 3600000,
      timeEstimate: 7200000,
      isDone: true,
      tagIds: [],
      created: new Date('2026-03-19T09:00:00Z').getTime(),
      doneOn: new Date('2026-03-19T11:00:00Z').getTime(),
      projectId: 'P1',
      attachments: [],
      notes: 'Main note line 1\nMain note line 2',
      ...overrides,
    }) as Task;

  it('should export task notes, subtasks and attachments as markdown', () => {
    const task = createTask({
      attachments: [
        { id: 'A1', type: 'LINK', path: 'https://example.com', title: 'Spec' },
      ],
    });
    const subTask = createTask({
      id: 'S1',
      title: 'Draft changelog',
      notes: 'Remember screenshots',
      isDone: false,
      parentId: 'T1',
    });

    const result = exportTaskAsMarkdown({
      task,
      subTasks: [subTask],
      isArchived: true,
    });

    expect(result).toContain('# Plan release / notes');
    expect(result).toContain('- Archived: Yes');
    expect(result).toContain('## Notes');
    expect(result).toContain('Main note line 1');
    expect(result).toContain('## Subtasks');
    expect(result).toContain('- [ ] Draft changelog');
    expect(result).toContain('Remember screenshots');
    expect(result).toContain('## Attachments');
    expect(result).toContain('- [Spec](https://example.com)');
  });

  it('should sanitize the export file name', () => {
    const result = getTaskExportFileName(createTask(), '20260319_120000');

    expect(result).toBe('Plan-release-notes_20260319_120000.md');
  });

  it('should rewrite markdown image URLs for packaged image export', () => {
    const markdown =
      '## Notes\n\n![pasted image](indexeddb://clipboard-images/clip-1)\n\n![remote](https://example.com/a.png)';
    const refs = extractMarkdownImageRefs(markdown);
    const replacements = new Map([
      ['indexeddb://clipboard-images/clip-1', 'images/image-1.png'],
    ]);

    const result = rewriteMarkdownImageUrls(markdown, replacements);

    expect(refs.map((ref) => ref.url)).toEqual([
      'indexeddb://clipboard-images/clip-1',
      'https://example.com/a.png',
    ]);
    expect(result).toContain('![pasted image](images/image-1.png)');
    expect(result).toContain('![remote](https://example.com/a.png)');
  });

  it('should create a zip with markdown and image files', async () => {
    const blob = await createTaskExportZipBlob({
      markdownFileName: 'task.md',
      markdown: '# Task\n\n![pasted image](images/image-1.png)\n',
      images: [
        {
          fileName: 'image-1.png',
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        },
      ],
    });

    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect(strFromU8(entries['task.md'])).toContain(
      '![pasted image](images/image-1.png)',
    );
    expect(Array.from(entries['images/image-1.png'])).toEqual([1, 2, 3]);
  });
});
