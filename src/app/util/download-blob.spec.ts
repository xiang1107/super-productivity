import { downloadBlob } from './download-blob';

describe('downloadBlob in the browser', () => {
  let createUrl: jasmine.Spy<typeof URL.createObjectURL>;
  let revokeUrl: jasmine.Spy<typeof URL.revokeObjectURL>;
  let click: jasmine.Spy<() => void>;

  beforeEach(() => {
    createUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:task-export');
    revokeUrl = spyOn(URL, 'revokeObjectURL');
    click = spyOn(HTMLAnchorElement.prototype, 'click');
  });

  it('downloads the original bytes and cleans up its temporary URL and element', async () => {
    const blob = new Blob([new Uint8Array([0, 255, 128])], { type: 'application/zip' });
    let clickedFilename = '';
    click.and.callFake(function (this: HTMLAnchorElement) {
      clickedFilename = this.download;
      expect(this.isConnected).toBeTrue();
    });
    await expectAsync(downloadBlob('notes.zip', blob)).toBeResolvedTo({});
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(clickedFilename).toBe('notes.zip');
    expect(revokeUrl).toHaveBeenCalledWith('blob:task-export');
    expect(document.querySelector('a[download="notes.zip"]')).toBeNull();
  });

  it('cleans up and propagates failures to the export caller', async () => {
    click.and.throwError('download failed');
    await expectAsync(downloadBlob('notes.md', new Blob(['notes']))).toBeRejected();
    expect(revokeUrl).toHaveBeenCalledWith('blob:task-export');
    expect(document.querySelector('a[download="notes.md"]')).toBeNull();
  });
});
