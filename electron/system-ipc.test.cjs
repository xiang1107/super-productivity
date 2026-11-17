const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

require('ts-node/register/transpile-only');
const modulePath = path.resolve(__dirname, 'ipc-handlers/system.ts');
const originalLoad = Module._load;
let save;
let directory;
let dialogResult;
let dialogOptions;

test.beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sp-export-'));
  dialogResult = { canceled: false, filePath: path.join(directory, 'notes') };
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return {
        ipcMain: {
          on() {},
          handle(channel, handler) {
            if (channel === 'SAVE_FILE_DIALOG') save = handler;
          },
        },
        dialog: {
          async showSaveDialog(win, options) {
            dialogOptions = options;
            return dialogResult;
          },
        },
      };
    }
    if (request === '../main-window') return { getWin: () => ({}) };
    if (request === '../open-url') return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[modulePath];
  require(modulePath).initSystemIpc();
});

test.afterEach(async () => {
  Module._load = originalLoad;
  delete require.cache[modulePath];
  await fs.rm(directory, { recursive: true, force: true });
});

test('existing text saves retain UTF-8 encoding and JSON filters', async () => {
  await save({}, { filename: 'backup.json', data: '中文 notes' });
  assert.equal(await fs.readFile(dialogResult.filePath, 'utf8'), '中文 notes');
  assert.deepEqual(dialogOptions.filters[0].extensions, ['json']);
});

test('binary exports preserve bytes and use their requested filters', async () => {
  const bytes = Buffer.from([0, 255, 128, 80, 75]);
  const filters = [{ name: 'ZIP', extensions: ['zip'] }];
  await save(
    {},
    {
      filename: 'notes.zip',
      data: bytes.toString('base64'),
      options: { encoding: 'base64', filters },
    },
  );
  assert.deepEqual(await fs.readFile(dialogResult.filePath), bytes);
  assert.deepEqual(dialogOptions.filters, filters);
});

test('cancelled saves do not write a file', async () => {
  dialogResult.canceled = true;
  assert.deepEqual(await save({}, { filename: 'notes.zip', data: '' }), {
    success: false,
  });
  assert.deepEqual(await fs.readdir(directory), []);
});

test('write errors propagate instead of reporting success', async () => {
  dialogResult.filePath = path.join(directory, 'missing-directory', 'notes.zip');
  await assert.rejects(save({}, { filename: 'notes.zip', data: '' }));
});
