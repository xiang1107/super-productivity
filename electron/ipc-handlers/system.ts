import { app, dialog, ipcMain, shell } from 'electron';
import { IPC } from '../shared-with-frontend/ipc-events.const';
import { isExternalUrlSchemeAllowed } from '../shared-with-frontend/is-external-url-allowed';
import { isLocalFileUrl, openLocalPath } from '../open-url';
import { getWin } from '../main-window';
import type { ElectronAPI } from '../electronAPI';

interface SaveFileDialogPayload {
  filename: string;
  data: string;
  options?: Parameters<ElectronAPI['saveFileDialog']>[2];
}

export const initSystemIpc = (): void => {
  ipcMain.on(IPC.OPEN_PATH, (ev, path: string) => {
    // openLocalPath enforces the guards this sink needs: reject UNC / remote
    // file:// paths (NTLM-hash leak) and never launch an executable/script.
    // FILE-type task-attachment paths are synced and thus attacker-controllable.
    // See GHSA-hr87-735w-hfq3.
    openLocalPath(path);
  });
  ipcMain.on(IPC.OPEN_EXTERNAL, (ev, url: string) => {
    // Defense in depth: never hand an unsafe scheme to the OS handler, even if
    // the renderer-side guard is bypassed. See GHSA-hr87-735w-hfq3.
    if (!isExternalUrlSchemeAllowed(url)) {
      return;
    }
    // A local file: URL opens reliably via openPath, not openExternal:
    // openExternal percent-encodes the path on Windows and then can't resolve
    // non-ASCII names or spaces. openLocalPath decodes it and re-applies the
    // openPath guards. See issue #8695.
    if (isLocalFileUrl(url)) {
      openLocalPath(url);
      return;
    }
    shell.openExternal(url);
  });

  ipcMain.on(
    IPC.SHOW_EMOJI_PANEL,
    () => app.isEmojiPanelSupported() && app.showEmojiPanel(),
  );

  ipcMain.handle(
    IPC.SAVE_FILE_DIALOG,
    async (ev, { filename, data, options }: SaveFileDialogPayload) => {
      const result = await dialog.showSaveDialog(getWin(), {
        defaultPath: filename,
        filters: options?.filters ?? [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePath) {
        const fs = await import('fs');
        await fs.promises.writeFile(
          result.filePath,
          options?.encoding === 'base64' ? Buffer.from(data, 'base64') : data,
          options?.encoding === 'base64' ? undefined : 'utf-8',
        );
        return { success: true, path: result.filePath };
      }
      return { success: false };
    },
  );

  ipcMain.handle(IPC.SHARE_NATIVE, async () => {
    // Desktop platforms use the share dialog instead of native share
    // This allows for more flexibility and better UX with social media options
    return { success: false, error: 'Native share not available on desktop' };
  });
};
