import { Task } from './task.model';
import { exportTaskAsMarkdown, getTaskExportFileName } from './task-export.util';

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
      attachments: [{ id: 'A1', type: 'LINK', path: 'https://example.com', title: 'Spec' }],
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
});
