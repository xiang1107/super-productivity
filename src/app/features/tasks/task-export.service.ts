import { Injectable, InjectionToken, inject } from '@angular/core';
import { ClipboardImageService } from '../../core/clipboard-image/clipboard-image.service';
import { SnackService } from '../../core/snack/snack.service';
import { T } from '../../t.const';
import { downloadBlob } from '../../util/download-blob';
import { formatDateTimeForFilename } from '../../util/format-date-time-for-filename';
import type { Task } from './task.model';
import {
  createTaskExportZipBlob,
  exportTaskAsMarkdown,
  getTaskExportArchiveFileName,
  getTaskExportFileName,
  type TaskExportImageFile,
} from './task-export.util';
import {
  extractTaskExportImages,
  rewriteTaskExportImages,
} from './task-export-markdown.util';

export const TASK_EXPORT_DOWNLOAD = new InjectionToken<typeof downloadBlob>(
  'TASK_EXPORT_DOWNLOAD',
  { providedIn: 'root', factory: () => downloadBlob },
);

const IMAGE_EXTENSIONS = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['image/bmp', '.bmp'],
  ['image/avif', '.avif'],
]);

@Injectable({ providedIn: 'root' })
export class TaskExportService {
  private readonly _download = inject(TASK_EXPORT_DOWNLOAD);
  private readonly _snackService = inject(SnackService);
  private readonly _clipboardImageService = inject(ClipboardImageService);

  async exportTask(
    task: Task,
    subTasks: Task[] | Promise<Task[]> = [],
    isArchived = false,
  ): Promise<void> {
    try {
      const timestamp = formatDateTimeForFilename();
      const markdownFilename = getTaskExportFileName(task, timestamp);
      let markdown = exportTaskAsMarkdown({ task, subTasks: await subTasks, isArchived });
      const images: TaskExportImageFile[] = [];
      const replacements = new Map<string, string>();
      let missingImages = 0;

      for (const { url } of extractTaskExportImages(markdown)) {
        // Remote images stay links: exporting never makes a network request.
        if (!url.startsWith('indexeddb://') && !url.startsWith('file:')) {
          continue;
        }
        const image = await this._loadImage(url);
        if (!image) {
          missingImages++;
          continue;
        }
        const extension = IMAGE_EXTENSIONS.get(image.type) ?? '.png';
        const fileName = `image-${images.length + 1}${extension}`;
        images.push({ fileName, blob: image });
        replacements.set(url, `images/${fileName}`);
      }

      markdown = rewriteTaskExportImages(markdown, replacements);
      const filename = images.length
        ? getTaskExportArchiveFileName(task, timestamp)
        : markdownFilename;
      const blob = images.length
        ? await createTaskExportZipBlob({
            markdownFileName: markdownFilename,
            markdown,
            images,
          })
        : new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const result = await this._download(filename, blob, {
        filters: [
          images.length
            ? { name: 'ZIP', extensions: ['zip'] }
            : { name: 'Markdown', extensions: ['md'] },
        ],
      });
      if (result.wasCanceled) {
        return;
      }
      this._snackService.open(
        missingImages
          ? {
              type: 'WARNING',
              msg: T.F.TASK.EXPORT.MISSING_IMAGES,
              translateParams: { fileName: filename, count: missingImages },
            }
          : {
              type: 'SUCCESS',
              msg: T.GLOBAL_SNACK.FILE_DOWNLOADED,
              translateParams: { fileName: filename },
            },
      );
    } catch {
      // Image/file errors may contain note content or local paths. Do not log them.
      this._snackService.open({ type: 'ERROR', msg: T.F.TASK.EXPORT.FAILED });
    }
  }

  private async _loadImage(url: string): Promise<Blob | null> {
    try {
      // The service resolves only app-owned images and enforces the current
      // Electron image access boundary. Never revive arbitrary local-file reads.
      const resolved = await this._clipboardImageService.resolveClipboardImageUrl(url);
      if (!resolved) {
        return null;
      }
      const response = await fetch(resolved);
      return response.ok ? await response.blob() : null;
    } catch {
      return null;
    }
  }
}
