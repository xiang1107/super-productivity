import { TestBed } from '@angular/core/testing';
import { strFromU8, unzipSync } from 'fflate';
import { ClipboardImageService } from '../../core/clipboard-image/clipboard-image.service';
import { SnackService } from '../../core/snack/snack.service';
import { TaskExportService } from './task-export.service';

describe('TaskExportService', () => {
  let service: TaskExportService;
  let clipboardImageService: jasmine.SpyObj<ClipboardImageService>;

  beforeEach(() => {
    clipboardImageService = jasmine.createSpyObj<ClipboardImageService>(
      'ClipboardImageService',
      ['isIndexedDbUrl', 'extractImageId', 'getImage'],
    );
    clipboardImageService.isIndexedDbUrl.and.callFake((url: string) =>
      url.startsWith('indexeddb://clipboard-images/'),
    );
    clipboardImageService.extractImageId.and.returnValue('clip-1');
    clipboardImageService.getImage.and.returnValue(
      Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
    );

    TestBed.configureTestingModule({
      providers: [
        TaskExportService,
        { provide: ClipboardImageService, useValue: clipboardImageService },
        {
          provide: SnackService,
          useValue: jasmine.createSpyObj('SnackService', ['open']),
        },
      ],
    });

    service = TestBed.inject(TaskExportService);
  });

  it('should package indexeddb note images into the task export zip', async () => {
    const result = await (
      service as unknown as {
        _createImagePackage(
          markdown: string,
          markdownFilename: string,
        ): Promise<Blob | null>;
      }
    )._createImagePackage(
      '# Task\n\n![pasted image](indexeddb://clipboard-images/clip-1)\n',
      'task.md',
    );

    if (!result) {
      throw new Error('Expected image export package');
    }

    const entries = unzipSync(new Uint8Array(await result.arrayBuffer()));

    expect(clipboardImageService.getImage).toHaveBeenCalledWith('clip-1');
    expect(strFromU8(entries['task.md'])).toContain(
      '![pasted image](images/image-1.png)',
    );
    expect(Array.from(entries['images/image-1.png'])).toEqual([1, 2, 3]);
  });
});
