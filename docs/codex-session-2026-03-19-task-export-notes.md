# Codex Session Notes - 2026-03-19

## User request

The user uses this project as a todo/task manager and wants a new feature to export tasks together with their notes, because after tasks are completed and archived, notes are no longer easy to access in their workflow.

The user explicitly asked for:

- analysis
- planning
- development
- local environment setup
- local verification of the task export with notes feature

## Key product findings

- Archived task data already retains `task.notes`.
- The archived task detail dialog already renders notes from `task.notes`.
- So the real gap is not data loss during archive, but lack of a convenient export flow that preserves task content and notes outside the app.

## Implemented changes

### New export logic

Added a reusable Markdown export path for a single task:

- `src/app/features/tasks/task-export.util.ts`
- `src/app/features/tasks/task-export.service.ts`

Behavior:

- Exports one task as Markdown
- Includes:
  - task title
  - status
  - archived flag
  - created/completed timestamps
  - scheduled/deadline info
  - time spent / estimate
  - notes
  - subtasks
  - subtask notes
  - attachments
- Uses the existing download utility
- Shows the existing `FILE_DOWNLOADED` success snackbar

### UI entry points added

Added export action to:

- active task context menu
  - `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.ts`
  - `src/app/features/tasks/task-context-menu/task-context-menu-inner/task-context-menu-inner.component.html`
- archived task detail dialog
  - `src/app/features/tasks/dialog-view-archived-task/dialog-view-archived-task.component.ts`
  - `src/app/features/tasks/dialog-view-archived-task/dialog-view-archived-task.component.html`

Archived dialog export also includes a fallback fetch for subtasks from archive in case the dialog's async subtask loading has not finished yet.

### Translation keys

Added:

- `F.TASK.CMP.EXPORT_WITH_NOTES`

Updated files:

- `src/app/t.const.ts`
- `src/assets/i18n/en.json`

### Tests added

Unit/spec:

- `src/app/features/tasks/task-export.util.spec.ts`

Local E2E verification scripts created:

- `e2e/tests/import-export/task-export-notes.local.spec.ts`
- `e2e/tests/import-export/task-export-notes-active.local.spec.ts`

## Local environment setup completed

### Installed

- `npm install` completed successfully
- `node_modules` now exists
- Playwright Chromium was installed with:
  - `npx playwright install chromium`

### Local app run status

Angular dev server was started locally and `http://localhost:4200` returned HTTP 200 during verification.

### Important environment note

Current machine version:

- Node: `24.14.0`

Project preferred version from `package.json`:

- Node: `22.18.0`

This worked for install and local serve, but if future build/lint/test issues appear, switching back to Node 22 should be considered first.

## Validation status

### Confirmed working

The active task export flow was verified end-to-end with Playwright:

- create task
- open task detail
- add notes
- right-click task
- click `Export task with notes`
- capture downloaded file
- assert exported Markdown contains notes and `Archived: No`

Passing test:

- `e2e/tests/import-export/task-export-notes-active.local.spec.ts`

### Partially validated / still pending

The archived-task UI entry point was implemented but not fully proven with a stable E2E path yet.

What happened:

- export core logic is shared, so the file generation path itself is already validated
- the attempted local archived-task E2E failed on the worklog UI expansion path
- failure was due to unstable navigation/expansion/selection in worklog, not due to confirmed export-content failure

Pending item:

- stabilize the archived-task UI E2E flow so the archived dialog export button is also covered end-to-end

## Constraints encountered

### Repository check script

The repo asks to run:

- `npm run checkFile <filepath>`

But in this environment the script failed because its internal `spawnSync('npm')` resolution did not work reliably in the sandbox/Windows execution context.

Observed failures included:

- `spawnSync npm EPERM`
- `spawnSync npm ENOENT`

Also before `npm install`, local formatter binaries were unavailable because `node_modules` did not exist yet.

### Playwright browser issue

Initial Playwright verification failed because Chromium had not yet been downloaded. This was fixed by installing it locally.

## Recommended next steps

1. Stabilize archived-task E2E verification via worklog or another easier archive entry point.
2. Run repo formatting/lint checks again now that dependencies are installed, ideally in an unrestricted shell if needed.
3. Optionally extend the feature later to support:
   - bulk export of multiple tasks
   - JSON export of task + notes
   - CSV export for metadata-only use cases

## Most relevant files for future continuation

- `E:\projects\super-productivity\src\app\features\tasks\task-export.util.ts`
- `E:\projects\super-productivity\src\app\features\tasks\task-export.service.ts`
- `E:\projects\super-productivity\src\app\features\tasks\task-context-menu\task-context-menu-inner\task-context-menu-inner.component.ts`
- `E:\projects\super-productivity\src\app\features\tasks\task-context-menu\task-context-menu-inner\task-context-menu-inner.component.html`
- `E:\projects\super-productivity\src\app\features\tasks\dialog-view-archived-task\dialog-view-archived-task.component.ts`
- `E:\projects\super-productivity\src\app\features\tasks\dialog-view-archived-task\dialog-view-archived-task.component.html`
- `E:\projects\super-productivity\src\app\features\tasks\task-export.util.spec.ts`
- `E:\projects\super-productivity\e2e\tests\import-export\task-export-notes.local.spec.ts`
- `E:\projects\super-productivity\e2e\tests\import-export\task-export-notes-active.local.spec.ts`
- `E:\projects\super-productivity\docs\codex-session-2026-03-19-task-export-notes.md`
