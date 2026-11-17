import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { IS_ELECTRON } from '../app.constants';
import { IS_NATIVE_PLATFORM } from './is-native-platform';

export interface BlobDownloadResult {
  wasCanceled?: boolean;
  path?: string;
}

export interface BlobDownloadOptions {
  filters?: { name: string; extensions: string[] }[];
}

const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

/** Saves binary exports without changing the existing backup download flow. */
export const downloadBlob = async (
  filename: string,
  blob: Blob,
  options: BlobDownloadOptions = {},
): Promise<BlobDownloadResult> => {
  if (IS_NATIVE_PLATFORM) {
    const data = await toBase64(blob);
    try {
      const file = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Cache,
        recursive: true,
      });
      const uri =
        file.uri ??
        (await Filesystem.getUri({ path: filename, directory: Directory.Cache })).uri;
      await Share.share({ title: filename, files: [uri] });
      return {};
    } catch (error: unknown) {
      if (
        error === 'Share canceled' ||
        (typeof error === 'object' &&
          error !== null &&
          (('message' in error && error.message === 'Share canceled') ||
            ('name' in error && error.name === 'AbortError')))
      ) {
        return { wasCanceled: true };
      }
      const saved = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Documents,
        recursive: true,
      });
      return { path: saved.uri };
    }
  }
  if (IS_ELECTRON) {
    const result = await window.ea.saveFileDialog(filename, await toBase64(blob), {
      encoding: 'base64',
      filters: options.filters,
    });
    return result.success ? { path: result.path } : { wasCanceled: true };
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  return {};
};
