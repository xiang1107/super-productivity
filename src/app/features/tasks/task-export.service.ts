import { Injectable, inject } from '@angular/core';
import { SnackService } from '../../core/snack/snack.service';
import { T } from '../../t.const';
import { download, downloadBlob, type DownloadResult } from '../../util/download';
import { formatDateTimeForFilename } from '../../util/format-date-time-for-filename';
import type { Task } from './task.model';
import {
  createTaskExportZipBlob,
  exportTaskAsMarkdown,
  extractMarkdownImageRefs,
  getTaskExportArchiveFileName,
  getTaskExportFileName,
  rewriteMarkdownImageUrls,
  type TaskExportImageFile,
} from './task-export.util';
import { ClipboardImageService } from '../../core/clipboard-image/clipboard-image.service';
import { IS_ELECTRON } from '../../app.constants';

const IMAGE_EXPORT_DIR = 'images';

const IMAGE_MIME_EXTENSIONS = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['image/bmp', '.bmp'],
  ['image/avif', '.avif'],
]);

@Injectable({
  providedIn: 'root',
})
export class TaskExportService {
  private readonly _snackService = inject(SnackService);
  private readonly _clipboardImageService = inject(ClipboardImageService);

  async exportTask(task: Task, subTasks: Task[] = [], isArchived = false): Promise<void> {
    const timestamp = formatDateTimeForFilename();
    const markdownFilename = getTaskExportFileName(task, timestamp);
    const fileContent = exportTaskAsMarkdown({ task, subTasks, isArchived });
    const imagePackage = await this._createImagePackage(fileContent, markdownFilename);

    const filename = imagePackage
      ? getTaskExportArchiveFileName(task, timestamp)
      : markdownFilename;
    const result: DownloadResult = imagePackage
      ? await downloadBlob(filename, imagePackage, {
          filters: [
            { name: 'ZIP Archives', extensions: ['zip'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        })
      : await download(markdownFilename, fileContent, {
          mimeType: 'text/markdown;charset=utf-8',
          filters: [
            { name: 'Markdown Files', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });
    if (!result.wasCanceled) {
      this._snackService.open({
        type: 'SUCCESS',
        msg: T.GLOBAL_SNACK.FILE_DOWNLOADED,
        translateParams: { fileName: filename },
      });
    }
  }

  private async _createImagePackage(
    markdown: string,
    markdownFilename: string,
  ): Promise<Blob | null> {
    const imageRefs = extractMarkdownImageRefs(markdown);
    if (!imageRefs.length) {
      return null;
    }

    const replacements = new Map<string, string>();
    const images: TaskExportImageFile[] = [];

    for (const imageRef of imageRefs) {
      const blob = await this._loadExportableImage(imageRef.url);
      if (!blob) {
        continue;
      }

      const fileName = `image-${images.length + 1}${this._getImageExtension(
        blob.type,
        imageRef.url,
      )}`;
      images.push({ fileName, blob });
      replacements.set(imageRef.url, `${IMAGE_EXPORT_DIR}/${fileName}`);
    }

    if (!images.length) {
      return null;
    }

    return createTaskExportZipBlob({
      markdownFileName: markdownFilename,
      markdown: rewriteMarkdownImageUrls(markdown, replacements),
      images,
    });
  }

  private async _loadExportableImage(url: string): Promise<Blob | null> {
    if (this._clipboardImageService.isIndexedDbUrl(url)) {
      const imageId = this._clipboardImageService.extractImageId(url);
      return imageId ? this._clipboardImageService.getImage(imageId) : null;
    }

    if (IS_ELECTRON && url.startsWith('file://') && window.ea?.readLocalImageAsDataUrl) {
      const dataUrl = await window.ea.readLocalImageAsDataUrl(url);
      return dataUrl ? this._dataUrlToBlob(dataUrl) : null;
    }

    return null;
  }

  private _getImageExtension(mimeType: string, sourceUrl: string): string {
    const mimeExtension = IMAGE_MIME_EXTENSIONS.get(mimeType);
    if (mimeExtension) {
      return mimeExtension;
    }

    const urlExtension = sourceUrl
      .split(/[?#]/)[0]
      .match(/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i)?.[0];
    return urlExtension?.toLowerCase() ?? '.png';
  }

  private _dataUrlToBlob(dataUrl: string): Blob | null {
    const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
    if (!match) {
      return null;
    }

    const mimeType = match[1];
    const isBase64 = !!match[2];
    const data = match[3];
    const binary = isBase64 ? atob(data) : decodeURIComponent(data);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  }
}
