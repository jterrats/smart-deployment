import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';

describe('MetadataScannerService', () => {
  const tempDirectories: string[] = [];

  async function createProjectFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'metadata-scanner-service-'));
    tempDirectories.push(projectRoot);

    await writeFile(
      path.join(projectRoot, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '61.0',
        },
        null,
        2
      )
    );

    await mkdir(path.join(projectRoot, 'force-app', 'main', 'default', 'classes'), { recursive: true });
    await mkdir(path.join(projectRoot, 'force-app', 'main', 'default', 'lwc', 'accountCard'), { recursive: true });

    await writeFile(
      path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'AccountService.cls'),
      `public with sharing class AccountService {
  public static String loadName() {
    return 'Acme';
  }
}`
    );

    await writeFile(
      path.join(projectRoot, 'force-app', 'main', 'default', 'lwc', 'accountCard', 'accountCard.js'),
      `import { LightningElement } from 'lwc';
import loadName from '@salesforce/apex/AccountService.loadName';

export default class AccountCard extends LightningElement {
  connectedCallback() {
    void loadName();
  }
}`
    );

    await writeFile(
      path.join(projectRoot, 'force-app', 'main', 'default', 'lwc', 'accountCard', 'accountCard.js-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>61.0</apiVersion>
  <isExposed>true</isExposed>
  <targets>
    <target>lightning__RecordPage</target>
  </targets>
</LightningComponentBundle>`
    );

    return projectRoot;
  }

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (tempDirectory) => rm(tempDirectory, { recursive: true, force: true }))
    );
  });

  it('scans registered file and directory metadata handlers', async () => {
    const projectRoot = await createProjectFixture();
    const scanner = new MetadataScannerService();

    const result = await scanner.scan({ sourcePath: projectRoot });

    const componentIds = result.components.map((component) => `${component.type}:${component.name}`);

    expect(componentIds).to.include.members(['ApexClass:AccountService', 'LightningComponentBundle:accountCard']);

    const lwcComponent = result.components.find(
      (component) => component.type === 'LightningComponentBundle' && component.name === 'accountCard'
    );

    expect(lwcComponent).to.exist;
    expect([...lwcComponent!.dependencies]).to.include('AccountService.loadName');
  });
});
