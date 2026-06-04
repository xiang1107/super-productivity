import { msToString } from '../../ui/duration/ms-to-string.pipe';
import { TaskAttachment } from './task-attachment/task-attachment.model';
import { Task } from './task.model';

const FALLBACK_VALUE = '-';

export interface ExportTaskAsMarkdownInput {
  task: Task;
  subTasks?: Task[];
  isArchived?: boolean;
}

const formatDateTime = (timestamp?: number | null): string => {
  if (!timestamp) {
    return FALLBACK_VALUE;
  }
  return new Date(timestamp).toLocaleString();
};

const formatDate = (dateStr?: string | null): string => dateStr || FALLBACK_VALUE;

const formatTime = (time?: number): string => msToString(time, false, false);

const escapeFilenamePart = (value: string): string =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'task';

const formatAttachment = (attachment: TaskAttachment): string => {
  const label = attachment.title || attachment.path || 'Attachment';
  if (attachment.path) {
    return `- [${label}](${attachment.path})`;
  }
  return `- ${label}`;
};

const formatSubTask = (task: Task): string => {
  const checkBox = task.isDone ? 'x' : ' ';
  const noteSuffix = task.notes ? `\n  Notes: ${task.notes.replace(/\n/g, '\n  ')}` : '';
  return `- [${checkBox}] ${task.title}${noteSuffix}`;
};

export const exportTaskAsMarkdown = ({
  task,
  subTasks = [],
  isArchived = false,
}: ExportTaskAsMarkdownInput): string => {
  const lines: string[] = [
    `# ${task.title}`,
    '',
    '## Meta',
    `- Status: ${task.isDone ? 'Completed' : 'Open'}`,
    `- Archived: ${isArchived ? 'Yes' : 'No'}`,
    `- Created: ${formatDateTime(task.created)}`,
    `- Completed: ${formatDateTime(task.doneOn)}`,
    `- Scheduled day: ${formatDate(task.dueDay)}`,
    `- Scheduled time: ${formatDateTime(task.dueWithTime)}`,
    `- Deadline day: ${formatDate(task.deadlineDay)}`,
    `- Deadline time: ${formatDateTime(task.deadlineWithTime)}`,
    `- Time spent: ${formatTime(task.timeSpent)}`,
    `- Time estimate: ${formatTime(task.timeEstimate)}`,
    '',
  ];

  if (task.notes) {
    lines.push('## Notes', '', task.notes, '');
  }

  if (subTasks.length) {
    lines.push('## Subtasks', '', ...subTasks.map(formatSubTask), '');
  }

  if (task.attachments?.length) {
    lines.push('## Attachments', '', ...task.attachments.map(formatAttachment), '');
  }

  return lines.join('\n').trimEnd() + '\n';
};

export const getTaskExportFileName = (task: Task, timestamp: string): string =>
  `${escapeFilenamePart(task.title)}_${timestamp}.md`;
