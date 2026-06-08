import { Directory, Encoding, Filesystem, WriteFileResult } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { IS_NATIVE_PLATFORM } from './is-native-platform';
import { Log } from '../core/log';
// Type definitions for window.ea are in ../core/window-ea.d.ts

export interface DownloadResult {
  isSnap?: boolean;
  isElectron?: boolean;
  path?: string;
  wasCanceled?: boolean;
}

export interface DownloadOptions {
  mimeType?: string;
  filters?: { name: string; extensions: string[] }[];
}

const isRunningInSnap = (): boolean => {
  return !!window.ea?.isSnap?.();
};

const canUseElectronSaveDialog = (): boolean => {
  return !!window.ea?.saveFileDialog;
};

export const download = async (
  filename: string,
  stringData: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> => {
  // Use Capacitor Filesystem + Share for native mobile platforms (Android and iOS)
  if (IS_NATIVE_PLATFORM) {
    try {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: stringData,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      try {
        await Share.share({
          title: filename,
          files: [fileResult.uri],
        });
      } catch (shareError: unknown) {
        const isCanceled =
          shareError === 'Share canceled' ||
          (shareError instanceof Error &&
            (shareError.message === 'Share canceled' ||
              shareError.name === 'AbortError'));
        if (isCanceled) {
          return { wasCanceled: true };
        } else {
          throw shareError;
        }
      }
    } catch (e) {
      Log.error(e);
      await saveStringAsFile(filename, stringData);
    }
    return { wasCanceled: false };
  } else if (canUseElectronSaveDialog()) {
    // Use the native dialog in Electron to avoid inconsistent Chromium download
    // behavior across Linux desktop environments.
    const result = await window.ea.saveFileDialog(filename, stringData, {
      filters: options.filters,
    });
    if (result.success && result.path) {
      Log.log('File saved to:', result.path);
      return { isElectron: true, isSnap: isRunningInSnap(), path: result.path };
    }
    return { isElectron: true, isSnap: isRunningInSnap(), wasCanceled: true };
  } else {
    const blob = new Blob([stringData], {
      type: options.mimeType ?? 'text/plain;charset=utf-8',
    });
    triggerBrowserDownload(filename, blob);
    return {};
  }
};

export const downloadBlob = async (
  filename: string,
  blob: Blob,
  options: DownloadOptions = {},
): Promise<DownloadResult> => {
  if (IS_NATIVE_PLATFORM) {
    try {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: await blobToBase64(blob),
        directory: Directory.Cache,
        recursive: true,
      });

      try {
        await Share.share({
          title: filename,
          files: [fileResult.uri],
        });
      } catch (shareError: unknown) {
        const isCanceled =
          shareError === 'Share canceled' ||
          (shareError instanceof Error &&
            (shareError.message === 'Share canceled' ||
              shareError.name === 'AbortError'));
        if (isCanceled) {
          return { wasCanceled: true };
        }
        throw shareError;
      }
    } catch (e) {
      Log.error(e);
      await saveBlobAsFile(filename, blob);
    }
    return { wasCanceled: false };
  } else if (canUseElectronSaveDialog()) {
    const result = await window.ea.saveFileDialog(filename, await blobToBase64(blob), {
      encoding: 'base64',
      filters: options.filters,
    });
    if (result.success && result.path) {
      Log.log('File saved to:', result.path);
      return { isElectron: true, isSnap: isRunningInSnap(), path: result.path };
    }
    return { isElectron: true, isSnap: isRunningInSnap(), wasCanceled: true };
  } else {
    triggerBrowserDownload(filename, blob);
    return {};
  }
};

/**
 * Saves a string content as a file in the app's Documents directory.
 * @param fileName The desired name for the file (e.g., 'my-data.txt', 'report.json').
 * @param content The string content to save.
 */
const saveStringAsFile = async (
  fileName: string,
  content: string,
): Promise<WriteFileResult> => {
  const r = await Filesystem.writeFile({
    path: fileName,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  Log.log(r);
  return r;
};

const saveBlobAsFile = async (fileName: string, blob: Blob): Promise<WriteFileResult> => {
  const r = await Filesystem.writeFile({
    path: fileName,
    data: await blobToBase64(blob),
    directory: Directory.Documents,
    recursive: true,
  });
  Log.log(r);
  return r;
};

const triggerBrowserDownload = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// interestingly this can't live in the logs.ts or it leads to weird "window" not found errors
export const downloadLogs = async (): Promise<void> => {
  await download('SP-logs.json', Log.exportLogHistory());
};
