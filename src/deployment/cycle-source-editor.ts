import { createHash } from 'node:crypto';
import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

export interface CycleSourceEditRequest {
  filePath: string;
  targetDescription: string;
  targetDependency: string;
  sourceSnippet: string;
}

export interface CycleSourceBackupRecord {
  filePath: string;
  backupPath: string;
  originalHash: string;
  created: boolean;
}

export interface CycleSourceEditRecord {
  operation: 'comment-reference';
  filePath: string;
  backupPath: string;
  targetDescription: string;
  targetDependency: string;
  sourceSnippet: string;
  replacementSnippet: string;
  originalHash: string;
  editedHash: string;
}

export interface CycleSourceRestoreResult {
  restored: boolean;
  reason?: 'backup-missing' | 'hash-mismatch';
  restoredHash?: string;
  currentHash?: string;
}

function createBackupPath(filePath: string): string {
  return `${filePath}.cycle-remediation.bak`;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function countOccurrences(content: string, snippet: string): number {
  if (snippet.length === 0) {
    return 0;
  }

  let count = 0;
  let index = 0;

  while (index <= content.length - snippet.length) {
    const nextIndex = content.indexOf(snippet, index);
    if (nextIndex === -1) {
      break;
    }

    count += 1;
    index = nextIndex + snippet.length;
  }

  return count;
}

function createReplacementSnippet(request: CycleSourceEditRequest): string {
  const header =
    `// cycle-remediation: comment-reference ${request.targetDependency}` + ` | ${request.targetDescription}`;
  const commentedSnippet = request.sourceSnippet
    .split('\n')
    .map((line) => (line.length === 0 ? '//' : `// ${line}`))
    .join('\n');

  return `${header}\n${commentedSnippet}\n// cycle-remediation: end`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export class CycleSourceEditor {
  public async createBackup(filePath: string): Promise<CycleSourceBackupRecord> {
    const originalContent = await readFile(filePath, 'utf8');
    const originalHash = hashContent(originalContent);
    const backupPath = createBackupPath(filePath);

    if (!(await fileExists(backupPath))) {
      await writeFile(backupPath, originalContent, 'utf8');
      return {
        filePath,
        backupPath,
        originalHash,
        created: true,
      };
    }

    const backupContent = await readFile(backupPath, 'utf8');
    const backupHash = hashContent(backupContent);
    if (backupHash !== originalHash) {
      throw new Error(
        `Backup mismatch for ${filePath}; refusing to overwrite ${backupPath} with different source content.`
      );
    }

    return {
      filePath,
      backupPath,
      originalHash,
      created: false,
    };
  }

  public async applyEdit(request: CycleSourceEditRequest): Promise<CycleSourceEditRecord> {
    if (request.sourceSnippet.trim().length === 0) {
      throw new Error(`Cycle remediation edit for ${request.filePath} requires a non-empty sourceSnippet.`);
    }

    const originalContent = await readFile(request.filePath, 'utf8');
    const matchCount = countOccurrences(originalContent, request.sourceSnippet);

    if (matchCount !== 1) {
      throw new Error(
        `Cycle remediation edit for ${request.filePath} requires exactly one sourceSnippet match; found ${matchCount}.`
      );
    }

    const backupRecord = await this.createBackup(request.filePath);
    const replacementSnippet = createReplacementSnippet(request);
    const editedContent = originalContent.replace(request.sourceSnippet, replacementSnippet);
    const editedHash = hashContent(editedContent);

    await writeFile(request.filePath, editedContent, 'utf8');

    return {
      operation: 'comment-reference',
      filePath: request.filePath,
      backupPath: backupRecord.backupPath,
      targetDescription: request.targetDescription,
      targetDependency: request.targetDependency,
      sourceSnippet: request.sourceSnippet,
      replacementSnippet,
      originalHash: backupRecord.originalHash,
      editedHash,
    };
  }

  public async restoreEdit(record: CycleSourceEditRecord): Promise<CycleSourceRestoreResult> {
    if (!(await fileExists(record.backupPath))) {
      return {
        restored: false,
        reason: 'backup-missing',
      };
    }

    const currentContent = await readFile(record.filePath, 'utf8');
    const currentHash = hashContent(currentContent);
    if (currentHash !== record.editedHash) {
      return {
        restored: false,
        reason: 'hash-mismatch',
        currentHash,
      };
    }

    const backupContent = await readFile(record.backupPath, 'utf8');
    const restoredHash = hashContent(backupContent);

    await writeFile(record.filePath, backupContent, 'utf8');
    await unlink(record.backupPath);

    return {
      restored: true,
      restoredHash,
    };
  }
}
