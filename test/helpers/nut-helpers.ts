import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execCmd } from '@salesforce/cli-plugins-testkit';

export type NutContext = {
  tempDir: string;
  homeDir: string;
  repoRoot: string;
};

export async function createNutContext(prefix = 'smart-deployment-nut-'): Promise<NutContext> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const homeDir = path.join(tempDir, 'home');

  await mkdir(path.join(homeDir, '.sf'), { recursive: true });
  await mkdir(path.join(homeDir, '.sfdx'), { recursive: true });

  return {
    tempDir,
    homeDir,
    repoRoot: process.cwd(),
  };
}

export async function cleanupNutContexts(tempDirs: string[]): Promise<void> {
  await Promise.all(tempDirs.map(async (dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.splice(0, tempDirs.length);
}

export async function createSalesforceProject(
  rootDir: string,
  projectName: string,
  files: Record<string, string>
): Promise<string> {
  const projectRoot = path.join(rootDir, projectName);

  await rm(projectRoot, { recursive: true, force: true });
  await mkdir(projectRoot, { recursive: true });
  await writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify(
      {
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '61.0',
      },
      null,
      2
    ),
    'utf8'
  );
  await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = path.join(projectRoot, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents, 'utf8');
    })
  );

  return projectRoot;
}

export function execNutCommand<T = unknown>(command: string, homeDir: string, ensureExitCode: 0 | 'nonZero' = 0) {
  return execNutCommandWithOptions<T>(command, {
    homeDir,
    ensureExitCode,
  });
}

export function execNutCommandWithOptions<T = unknown>(
  command: string,
  options: {
    homeDir: string;
    ensureExitCode?: 0 | 'nonZero';
    cwd?: string;
  }
) {
  return execCmd<T>(command, {
    cwd: options.cwd ?? process.cwd(),
    ensureExitCode: options.ensureExitCode ?? 0,
    cli: 'dev',
    env: { ...process.env, HOME: options.homeDir, TESTKIT_HOMEDIR: options.homeDir },
  });
}

export function parseJsonStdout<T>(stdout: string): T {
  const trimmed = stdout.trim();
  const lastObjectStart = Math.max(trimmed.lastIndexOf('\n{'), trimmed.lastIndexOf('\r\n{'));

  if (lastObjectStart >= 0) {
    const jsonBlock = trimmed.slice(trimmed[lastObjectStart] === '{' ? lastObjectStart : lastObjectStart + 1);

    try {
      const parsed = JSON.parse(jsonBlock) as { result?: T };
      return parsed.result ?? (parsed as T);
    } catch {
      // Fall back to line-based parsing below.
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let fallbackLogObject: T | undefined;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]) as Record<string, unknown> & { result?: T };
      const looksLikeLogRecord =
        'timestamp' in parsed && 'level' in parsed && 'component' in parsed && 'message' in parsed;

      if (!looksLikeLogRecord) {
        return parsed.result ?? (parsed as T);
      }

      fallbackLogObject = parsed as T;
    } catch {
      continue;
    }
  }

  if (fallbackLogObject !== undefined) {
    return fallbackLogObject;
  }

  throw new Error(`No parseable JSON object found in stdout:\n${stdout}`);
}
