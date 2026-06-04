import { Injectable, inject } from '@angular/core';
import { SnackService } from '../../core/snack/snack.service';
import { T } from '../../t.const';
import { download } from '../../util/download';
import { formatDateTimeForFilename } from '../../util/format-date-time-for-filename';
import { Task } from './task.model';
import { exportTaskAsMarkdown, getTaskExportFileName } from './task-export.util';

@Injectable({
  providedIn: 'root',
})
export class TaskExportService {
  private readonly _snackService = inject(SnackService);

  async exportTask(task: Task, subTasks: Task[] = [], isArchived = false): Promise<void> {
    const timestamp = formatDateTimeForFilename();
    const filename = getTaskExportFileName(task, timestamp);
    const fileContent = exportTaskAsMarkdown({ task, subTasks, isArchived });

    const result = await download(filename, fileContent);
    if (!result.wasCanceled) {
      this._snackService.open({
        type: 'SUCCESS',
        msg: T.GLOBAL_SNACK.FILE_DOWNLOADED,
        translateParams: { fileName: filename },
      });
    }
  }
}
