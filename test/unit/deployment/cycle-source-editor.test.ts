import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CycleSourceEditor } from '../../../src/deployment/cycle-source-editor.js';

describe('CycleSourceEditor', () => {
  let testDir: string;
  let filePath: string;
  let editor: CycleSourceEditor;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(os.tmpdir(), 'cycle-source-editor-'));
    filePath = path.join(testDir, 'Example.cls');
    editor = new CycleSourceEditor();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('creates a backup for the original source file', async () => {
    const originalSource = [
      'public with sharing class Example {',
      '  public void run() {',
      '    Beta.execute();',
      '  }',
      '}',
      '',
    ].join('\n');
    await writeFile(filePath, originalSource, 'utf8');

    const backupRecord = await editor.createBackup(filePath);
    const backupContent = await readFile(backupRecord.backupPath, 'utf8');

    expect(backupRecord.filePath).to.equal(filePath);
    expect(backupRecord.created).to.equal(true);
    expect(backupContent).to.equal(originalSource);
  });

  it('applies a conservative comment-reference edit and emits an edit record', async () => {
    const sourceSnippet = '    Beta.execute();';
    const originalSource = [
      'public with sharing class Example {',
      '  public void run() {',
      sourceSnippet,
      '  }',
      '}',
      '',
    ].join('\n');
    await writeFile(filePath, originalSource, 'utf8');

    const record = await editor.applyEdit({
      filePath,
      targetDescription: 'Temporarily comment the Example reference to ApexClass:Beta during phase 1.',
      targetDependency: 'ApexClass:Beta',
      sourceSnippet,
    });
    const editedSource = await readFile(filePath, 'utf8');

    expect(record.operation).to.equal('comment-reference');
    expect(record.filePath).to.equal(filePath);
    expect(record.targetDependency).to.equal('ApexClass:Beta');
    expect(record.originalHash).to.not.equal(record.editedHash);
    expect(editedSource).to.include(
      '// cycle-remediation: comment-reference ApexClass:Beta | Temporarily comment the Example reference to ApexClass:Beta during phase 1.'
    );
    expect(editedSource).to.include('//     Beta.execute();');
    expect(editedSource).to.not.include(`\n${sourceSnippet}\n`);
  });

  it('restores the original source from the backup after an edit', async () => {
    const sourceSnippet = '    Beta.execute();';
    const originalSource = [
      'public with sharing class Example {',
      '  public void run() {',
      sourceSnippet,
      '  }',
      '}',
      '',
    ].join('\n');
    await writeFile(filePath, originalSource, 'utf8');

    const record = await editor.applyEdit({
      filePath,
      targetDescription: 'Temporarily comment the Example reference to ApexClass:Beta during phase 1.',
      targetDependency: 'ApexClass:Beta',
      sourceSnippet,
    });

    const result = await editor.restoreEdit(record);
    const restoredSource = await readFile(filePath, 'utf8');

    expect(result.restored).to.equal(true);
    expect(result.reason).to.equal(undefined);
    expect(restoredSource).to.equal(originalSource);
  });

  it('fails restore idempotently when the backup has already been consumed', async () => {
    const sourceSnippet = '    Beta.execute();';
    const originalSource = [
      'public with sharing class Example {',
      '  public void run() {',
      sourceSnippet,
      '  }',
      '}',
      '',
    ].join('\n');
    await writeFile(filePath, originalSource, 'utf8');

    const record = await editor.applyEdit({
      filePath,
      targetDescription: 'Temporarily comment the Example reference to ApexClass:Beta during phase 1.',
      targetDependency: 'ApexClass:Beta',
      sourceSnippet,
    });

    const firstRestore = await editor.restoreEdit(record);
    const secondRestore = await editor.restoreEdit(record);

    expect(firstRestore.restored).to.equal(true);
    expect(secondRestore).to.deep.equal({
      restored: false,
      reason: 'backup-missing',
    });
  });

  it('protects restore when the edited file hash no longer matches the edit record', async () => {
    const sourceSnippet = '    Beta.execute();';
    const originalSource = [
      'public with sharing class Example {',
      '  public void run() {',
      sourceSnippet,
      '  }',
      '}',
      '',
    ].join('\n');
    await writeFile(filePath, originalSource, 'utf8');

    const record = await editor.applyEdit({
      filePath,
      targetDescription: 'Temporarily comment the Example reference to ApexClass:Beta during phase 1.',
      targetDependency: 'ApexClass:Beta',
      sourceSnippet,
    });

    await writeFile(filePath, 'modified after apply\n', 'utf8');

    const result = await editor.restoreEdit(record);
    const currentSource = await readFile(filePath, 'utf8');

    expect(result.restored).to.equal(false);
    expect(result.reason).to.equal('hash-mismatch');
    expect(result.currentHash).to.be.a('string');
    expect(currentSource).to.equal('modified after apply\n');
  });
});
