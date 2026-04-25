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

  async function createSecurityMetadataFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'metadata-scanner-security-'));
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

    const profileDir = path.join(projectRoot, 'force-app', 'main', 'default', 'profiles');
    const permissionSetDir = path.join(projectRoot, 'force-app', 'main', 'default', 'permissionsets');
    await mkdir(profileDir, { recursive: true });
    await mkdir(permissionSetDir, { recursive: true });

    await writeFile(
      path.join(profileDir, 'Admin.profile-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <custom>true</custom>
  <classAccesses>
    <apexClass>AccountService</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <layoutAssignments>
    <layout>Account-Account Layout</layout>
  </layoutAssignments>
  <pageAccesses>
    <apexPage>AccountConsole</apexPage>
    <enabled>true</enabled>
  </pageAccesses>
  <applicationVisibilities>
    <application>Sales</application>
    <default>false</default>
    <visible>true</visible>
  </applicationVisibilities>
  <tabVisibilities>
    <tab>standard-Account</tab>
    <visibility>DefaultOn</visibility>
  </tabVisibilities>
</Profile>`
    );

    await writeFile(
      path.join(permissionSetDir, 'Sales.permissionset-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Sales</label>
  <classAccesses>
    <apexClass>AccountService</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <pageAccesses>
    <apexPage>AccountConsole</apexPage>
    <enabled>true</enabled>
  </pageAccesses>
  <applicationVisibilities>
    <application>Sales</application>
    <default>false</default>
    <visible>true</visible>
  </applicationVisibilities>
  <tabSettings>
    <tab>standard-Account</tab>
    <visibility>Visible</visibility>
  </tabSettings>
</PermissionSet>`
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

  it('marks presentation and access dependencies as optional for security metadata', async () => {
    const projectRoot = await createSecurityMetadataFixture();
    const scanner = new MetadataScannerService();

    const result = await scanner.scan({ sourcePath: projectRoot });

    const profile = result.components.find((component) => component.type === 'Profile' && component.name === 'Admin');
    const permissionSet = result.components.find(
      (component) => component.type === 'PermissionSet' && component.name === 'Sales'
    );

    expect(profile).to.exist;
    expect(permissionSet).to.exist;
    expect([...(profile!.optionalDependencies ?? [])]).to.include.members([
      'Account-Account Layout',
      'AccountConsole',
      'Sales',
      'standard-Account',
    ]);
    expect([...(permissionSet!.optionalDependencies ?? [])]).to.include.members([
      'AccountConsole',
      'Sales',
      'standard-Account',
    ]);
    expect([...profile!.dependencies]).to.include('AccountService');
    expect([...permissionSet!.dependencies]).to.include('AccountService');
  });
});
