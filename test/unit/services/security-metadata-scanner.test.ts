import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  parsePermissionSetComponent,
  parseProfileComponent,
} from '../../../src/services/scanners/security-metadata-scanner.js';

describe('security-metadata-scanner', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it('builds a Profile component with normalized hard and optional dependencies', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'security-profile-'));
    tempDirectories.push(root);
    const profileDir = path.join(root, 'profiles');
    await mkdir(profileDir, { recursive: true });

    const profilePath = path.join(profileDir, 'Admin.profile-meta.xml');
    await writeFile(
      profilePath,
      `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
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
    <visible>true</visible>
  </applicationVisibilities>
  <tabVisibilities>
    <tab>standard-Account</tab>
    <visibility>DefaultOn</visibility>
  </tabVisibilities>
</Profile>`,
      'utf8'
    );

    const component = await parseProfileComponent(profilePath);

    expect(component).to.not.equal(undefined);
    expect(component!).to.deep.include({
      name: 'Admin',
      type: 'Profile',
      filePath: profilePath,
      priorityBoost: 0,
    });
    expect([...component!.dependencies]).to.include.members([
      'ApexClass:AccountService',
      'Layout:Account-Account Layout',
      'VisualforcePage:AccountConsole',
      'LightningApp:Sales',
      'standard-Account',
    ]);
    expect([...(component!.optionalDependencies ?? new Set())]).to.include.members([
      'Layout:Account-Account Layout',
      'VisualforcePage:AccountConsole',
      'LightningApp:Sales',
      'standard-Account',
    ]);
  });

  it('builds a PermissionSet component with normalized hard and optional dependencies', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'security-permissionset-'));
    tempDirectories.push(root);
    const permissionSetDir = path.join(root, 'permissionsets');
    await mkdir(permissionSetDir, { recursive: true });

    const permissionSetPath = path.join(permissionSetDir, 'Sales.permissionset-meta.xml');
    await writeFile(
      permissionSetPath,
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
    <visible>true</visible>
  </applicationVisibilities>
  <tabSettings>
    <tab>standard-Account</tab>
    <visibility>Visible</visibility>
  </tabSettings>
  <recordTypeVisibilities>
    <recordType>Account.Business</recordType>
    <visible>true</visible>
  </recordTypeVisibilities>
</PermissionSet>`,
      'utf8'
    );

    const component = await parsePermissionSetComponent(permissionSetPath);

    expect(component).to.not.equal(undefined);
    expect(component!).to.deep.include({
      name: 'Sales',
      type: 'PermissionSet',
      filePath: permissionSetPath,
      priorityBoost: 0,
    });
    expect([...component!.dependencies]).to.include.members([
      'ApexClass:AccountService',
      'VisualforcePage:AccountConsole',
      'LightningApp:Sales',
      'standard-Account',
      'RecordType:Account.Business',
    ]);
    expect([...(component!.optionalDependencies ?? new Set())]).to.include.members([
      'VisualforcePage:AccountConsole',
      'LightningApp:Sales',
      'standard-Account',
    ]);
  });
});
