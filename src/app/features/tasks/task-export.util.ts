import { strToU8, zipSync } from 'fflate';
import { msToString } from '../../ui/duration/ms-to-string.pipe';
import type { TaskAttachment } from './task-attachment/task-attachment.model';
import type { Task } from './task.model';

const FALLBACK_VALUE = '-';

export interface ExportTaskAsMarkdownInput {
  task: Task;
  subTasks?: Task[];
  isArchived?: boolean;
}

export interface MarkdownImageRef {
  url: string;
  destination: string;
}

export interface TaskExportImageFile {
  fileName: string;
  blob: Blob;
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

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(([^)]*)\)/g;

const extractUrlFromDestination = (destination: string): string | null => {
  const trimmed = destination.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('<')) {
    const endIndex = trimmed.indexOf('>');
    return endIndex > 1 ? trimmed.slice(1, endIndex) : null;
  }

  const titleMatch = trimmed.match(
    /^(.+?)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)|=\d*x\d*))?$/,
  );
  return titleMatch?.[1]?.trim() || null;
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

export const getTaskExportArchiveFileName = (task: Task, timestamp: string): string =>
  `${escapeFilenamePart(task.title)}_${timestamp}.zip`;

export const extractMarkdownImageRefs = (markdown: string): MarkdownImageRef[] => {
  const refs: MarkdownImageRef[] = [];
  const seenUrls = new Set<string>();

  for (const match of markdown.matchAll(MARKDOWN_IMAGE_REGEX)) {
    const destination = match[1];
    const url = extractUrlFromDestination(destination);
    if (!url || seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);
    refs.push({ url, destination });
  }

  return refs;
};

export const rewriteMarkdownImageUrls = (
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string =>
  markdown.replace(MARKDOWN_IMAGE_REGEX, (fullMatch: string, destination: string) => {
    const url = extractUrlFromDestination(destination);
    const replacement = url ? replacements.get(url) : undefined;
    return url && replacement ? fullMatch.replace(url, replacement) : fullMatch;
  });

export const createTaskExportZipBlob = async ({
  markdownFileName,
  markdown,
  images,
}: {
  markdownFileName: string;
  markdown: string;
  images: TaskExportImageFile[];
}): Promise<Blob> => {
  const entries: Record<string, Uint8Array> = {
    [markdownFileName]: strToU8(markdown),
  };

  for (const image of images) {
    entries[`images/${image.fileName}`] = new Uint8Array(await image.blob.arrayBuffer());
  }

  return new Blob([zipSync(entries)], { type: 'application/zip' });
};
