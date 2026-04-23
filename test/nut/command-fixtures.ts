import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DeploymentState } from '../../src/deployment/state-manager.js';

export type NutWorkspace = {
  tempDir: string;
  homeDir: string;
};

export async function createNutWorkspace(prefix: string): Promise<NutWorkspace> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const homeDir = path.join(tempDir, 'home');

  await mkdir(path.join(homeDir, '.sf'), { recursive: true });
  await mkdir(path.join(homeDir, '.sfdx'), { recursive: true });

  return { tempDir, homeDir };
}

export async function cleanupNutWorkspace(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}

export async function createStandardProject(rootDir: string, projectName = 'standard-project'): Promise<string> {
  const projectRoot = path.join(rootDir, projectName);
  const classesDir = path.join(projectRoot, 'force-app/main/default/classes');

  await rm(projectRoot, { recursive: true, force: true });
  await mkdir(classesDir, { recursive: true });

  await writeProjectConfig(projectRoot);
  await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');
  await writeFile(path.join(classesDir, 'TestClass.cls'), 'public class TestClass {}', 'utf8');
  await writeFile(
    path.join(classesDir, 'TestClass.cls-meta.xml'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
      '  <apiVersion>61.0</apiVersion>',
      '  <status>Active</status>',
      '</ApexClass>',
      '',
    ].join('\n'),
    'utf8'
  );

  return projectRoot;
}

export async function createCorruptedProject(rootDir: string, projectName = 'corrupted-project'): Promise<string> {
  const projectRoot = path.join(rootDir, projectName);
  const classesDir = path.join(projectRoot, 'force-app/main/default/classes');

  await rm(projectRoot, { recursive: true, force: true });
  await mkdir(classesDir, { recursive: true });

  await writeProjectConfig(projectRoot);
  await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');
  await writeFile(path.join(classesDir, 'Broken.cls'), 'public class Broken {', 'utf8');
  await writeFile(
    path.join(classesDir, 'Broken.cls-meta.xml'),
    '<?xml version="1.0" encoding="UTF-8"?><ApexClass><unclosed>',
    'utf8'
  );

  return projectRoot;
}

export async function writeDeploymentState(projectRoot: string, state: DeploymentState): Promise<string> {
  const stateDir = path.join(projectRoot, '.smart-deployment');
  const stateFile = path.join(stateDir, 'deployment-state.json');

  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');

  return stateFile;
}

export async function readDeploymentState(projectRoot: string): Promise<DeploymentState> {
  const stateFile = path.join(projectRoot, '.smart-deployment', 'deployment-state.json');
  const content = await readFile(stateFile, 'utf8');
  return JSON.parse(content) as DeploymentState;
}

export async function stateFileExists(projectRoot: string): Promise<boolean> {
  try {
    await access(path.join(projectRoot, '.smart-deployment', 'deployment-state.json'), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function writeProjectConfig(projectRoot: string): Promise<void> {
  return writeFile(
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
}
