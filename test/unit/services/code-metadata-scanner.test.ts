import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  parseApexClassComponent,
  parseLwcComponent,
  type ScannerContext,
} from '../../../src/services/scanners/code-metadata-scanner.js';

describe('code-metadata-scanner', () => {
  const tempDirectories: string[] = [];

  function createContext(errors: string[]): ScannerContext {
    return {
      fileExists: async (filePath: string) => {
        try {
          await access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      shouldIgnore: () => false,
      readFile,
      errors,
    };
  }

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((tempDirectory) => rm(tempDirectory, { recursive: true, force: true }))
    );
  });

  it('marks apex test classes from content instead of only naming', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'code-scanner-apex-'));
    tempDirectories.push(projectRoot);

    const classPath = path.join(projectRoot, 'ServiceValidationSpec.cls');
    await writeFile(
      classPath,
      `@IsTest
private class ServiceValidationSpec {
  @IsTest
  static void validates_service() {}
}`
    );

    const component = await parseApexClassComponent(classPath, createContext([]));

    expect(component).to.exist;
    expect(component).to.include({ name: 'ServiceValidationSpec', type: 'ApexClass' });
    expect((component as { isTest?: boolean }).isTest).to.equal(true);
  });

  it('parses lwc bundles using metadata and code files together', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'code-scanner-lwc-'));
    tempDirectories.push(projectRoot);

    const lwcDir = path.join(projectRoot, 'accountCard');
    await mkdir(lwcDir, { recursive: true });
    await writeFile(
      path.join(lwcDir, 'accountCard.js'),
      `import { LightningElement } from 'lwc';
import loadName from '@salesforce/apex/AccountService.loadName';
import panel from 'c/sharedPanel';

export default class AccountCard extends LightningElement {
  connectedCallback() {
    void loadName();
    void panel;
  }
}`
    );
    await writeFile(
      path.join(lwcDir, 'accountCard.js-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>61.0</apiVersion>
  <isExposed>true</isExposed>
</LightningComponentBundle>`
    );

    const component = await parseLwcComponent(lwcDir, createContext([]));

    expect(component).to.exist;
    expect(component).to.include({ name: 'accountCard', type: 'LightningComponentBundle' });
    expect([...component!.dependencies]).to.include.members(['AccountService.loadName', 'c:sharedPanel']);
  });
});
