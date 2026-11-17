import { TestBed } from '@angular/core/testing';
import { strFromU8, unzipSync } from 'fflate';
import { ClipboardImageService } from '../../core/clipboard-image/clipboard-image.service';
import { SnackService } from '../../core/snack/snack.service';
import { T } from '../../t.const';
import { downloadBlob } from '../../util/download-blob';
import { DEFAULT_TASK, Task } from './task.model';
import { TASK_EXPORT_DOWNLOAD, TaskExportService } from './task-export.service';

describe('TaskExportService', () => {
  let service: TaskExportService;
  let clipboard: jasmine.SpyObj<ClipboardImageService>;
  let snack: jasmine.SpyObj<SnackService>;
  let save: jasmine.Spy<typeof downloadBlob>;
  let fetchImage: jasmine.Spy<typeof fetch>;
  const imageUrl = 'indexeddb://clipboard-images/clip-1';
  const createTask = (notes: string): Task => ({
    ...DEFAULT_TASK,
    projectId: 'project-1',
    id: 'task-1',
    title: 'Task notes',
    notes,
  });
  const savedBlob = (): Blob => save.calls.mostRecent().args[1];

  beforeEach(() => {
    clipboard = jasmine.createSpyObj<ClipboardImageService>('ClipboardImageService', [
      'resolveClipboardImageUrl',
    ]);
    snack = jasmine.createSpyObj<SnackService>('SnackService', ['open']);
    save = jasmine.createSpy<typeof downloadBlob>('downloadBlob').and.resolveTo({});
    fetchImage = spyOn(window, 'fetch').and.resolveTo(
      new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
    );
    clipboard.resolveClipboardImageUrl.and.resolveTo('blob:clipboard-image');
    TestBed.configureTestingModule({
      providers: [
        TaskExportService,
        { provide: ClipboardImageService, useValue: clipboard },
        { provide: SnackService, useValue: snack },
        { provide: TASK_EXPORT_DOWNLOAD, useValue: save },
      ],
    });
    service = TestBed.inject(TaskExportService);
  });

  it('exports plain notes, subtasks and archive status as Markdown without fetching', async () => {
    const task = createTask('Main notes\n\n![remote](https://example.test/a.png)');
    await service.exportTask(
      task,
      [{ ...createTask('Child notes'), title: 'Child' }],
      true,
    );
    expect(save.calls.mostRecent().args[0]).toMatch(/\.md$/);
    const markdown = await savedBlob().text();
    expect(markdown).toContain('Main notes');
    expect(markdown).toContain('Child notes');
    expect(markdown).toContain('- Archived: Yes');
    expect(markdown).toContain('https://example.test/a.png');
    expect(fetchImage).not.toHaveBeenCalled();
    expect(snack.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'SUCCESS' }),
    );
  });

  it('exports deduplicated image bytes and portable links through the public entry point', async () => {
    await service.exportTask(
      createTask(`![a](${imageUrl})\n\n![b][img]\n\n[img]: ${imageUrl}`),
    );
    expect(save.calls.mostRecent().args[0]).toMatch(/\.zip$/);
    const entries = unzipSync(new Uint8Array(await savedBlob().arrayBuffer()));
    const markdown = strFromU8(
      entries[Object.keys(entries).find((name) => name.endsWith('.md'))!],
    );
    expect(markdown).toContain('![a](images/image-1.png)');
    expect(markdown).toContain('![b](images/image-1.png)');
    expect(Array.from(entries['images/image-1.png'])).toEqual([1, 2, 3]);
    expect(clipboard.resolveClipboardImageUrl).toHaveBeenCalledTimes(1);
    expect(fetchImage).toHaveBeenCalledWith('blob:clipboard-image');
  });

  it('does not package images mentioned only in code examples', async () => {
    await service.exportTask(createTask(`\`\`\`md\n![a](${imageUrl})\n\`\`\``));
    expect(save.calls.mostRecent().args[0]).toMatch(/\.md$/);
    expect(clipboard.resolveClipboardImageUrl).not.toHaveBeenCalled();
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it('keeps notes and warns when an image is unavailable', async () => {
    clipboard.resolveClipboardImageUrl.and.resolveTo(null);
    await service.exportTask(createTask(`Keep these notes\n![missing](${imageUrl})`));
    expect(await savedBlob().text()).toContain('Keep these notes');
    expect(snack.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'WARNING',
        msg: T.F.TASK.EXPORT.MISSING_IMAGES,
        translateParams: { fileName: save.calls.mostRecent().args[0], count: 1 },
      }),
    );
  });

  it('packages available images even when another image read throws', async () => {
    clipboard.resolveClipboardImageUrl.and.callFake(async (url) => {
      if (url === imageUrl) {
        throw new Error('private image path');
      }
      return 'blob:clipboard-image';
    });
    await service.exportTask(
      createTask(`![missing](${imageUrl})\n![ok](indexeddb://clipboard-images/clip-2)`),
    );
    expect(save.calls.mostRecent().args[0]).toMatch(/\.zip$/);
    expect(snack.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'WARNING' }),
    );
  });

  it('treats a failed blob read as a missing image', async () => {
    fetchImage.and.rejectWith(new Error('read failed'));
    await service.exportTask(createTask(`![a](${imageUrl})`));
    expect(save).toHaveBeenCalled();
    expect(snack.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'WARNING' }),
    );
  });

  it('does not show success or a missing-image warning after cancellation', async () => {
    clipboard.resolveClipboardImageUrl.and.resolveTo(null);
    save.and.resolveTo({ wasCanceled: true });
    await service.exportTask(createTask(`![a](${imageUrl})`));
    expect(snack.open).not.toHaveBeenCalled();
  });

  it('reports save failures without exposing their message', async () => {
    save.and.rejectWith(new Error('private task content and path'));
    await expectAsync(service.exportTask(createTask('Private notes'))).toBeResolved();
    expect(snack.open).toHaveBeenCalledOnceWith({
      type: 'ERROR',
      msg: T.F.TASK.EXPORT.FAILED,
    });
  });
  it('reports subtask loading failures without exporting an incomplete document', async () => {
    await service.exportTask(
      createTask('Notes'),
      Promise.reject(new Error('archive read failed')),
      true,
    );
    expect(save).not.toHaveBeenCalled();
    expect(snack.open).toHaveBeenCalledOnceWith({
      type: 'ERROR',
      msg: T.F.TASK.EXPORT.FAILED,
    });
  });
});
