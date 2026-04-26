import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  parseCustomMetadataComponents,
  parseCustomObjectComponent,
} from '../../../src/services/scanners/data-metadata-scanner.js';

describe('data-metadata-scanner helpers', () => {
  const tempDirectories: string[] = [];

  async function createFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'data-metadata-scanner-'));
    tempDirectories.push(projectRoot);

    const baseDir = path.join(projectRoot, 'force-app', 'main', 'default');
    await Promise.all([
      mkdir(path.join(baseDir, 'objects', 'Invoice__c'), { recursive: true }),
      mkdir(path.join(baseDir, 'customMetadata', 'RoutingConfig__mdt'), { recursive: true }),
    ]);

    await writeFile(
      path.join(baseDir, 'objects', 'Invoice__c', 'Invoice__c.object-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <deploymentStatus>Deployed</deploymentStatus>
  <fields>
    <fullName>Account__c</fullName>
    <label>Account</label>
    <referenceTo>Account</referenceTo>
    <relationshipLabel>Accounts</relationshipLabel>
    <relationshipName>Accounts</relationshipName>
    <type>Lookup</type>
  </fields>
  <fields>
    <fullName>ParentInvoice__c</fullName>
    <label>Parent Invoice</label>
    <referenceTo>Invoice__c</referenceTo>
    <relationshipLabel>Parent Invoices</relationshipLabel>
    <relationshipName>ParentInvoices</relationshipName>
    <type>MasterDetail</type>
  </fields>
  <label>Invoice</label>
  <pluralLabel>Invoices</pluralLabel>
  <sharingModel>ReadWrite</sharingModel>
</CustomObject>`
    );

    await writeFile(
      path.join(baseDir, 'customMetadata', 'RoutingConfig__mdt', 'RoutingConfig__mdt.md-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Routing Config</label>
  <pluralLabel>Routing Configs</pluralLabel>
  <fields>
    <fullName>Queue__c</fullName>
    <label>Queue</label>
    <referenceTo>Group</referenceTo>
    <type>MetadataRelationship</type>
  </fields>
</CustomMetadata>`
    );

    await writeFile(
      path.join(baseDir, 'customMetadata', 'RoutingConfig__mdt', 'RoutingConfig__mdt.Default.md'),
      `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Default</label>
  <values>
    <field>Queue__c</field>
    <value>Support Queue</value>
  </values>
</CustomMetadata>`
    );

    return baseDir;
  }

  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map(async (dir) => rm(dir, { recursive: true, force: true })));
  });

  it('preserves custom object and custom metadata dependency mapping', async () => {
    const baseDir = await createFixture();

    const [customObject, customMetadataComponents] = await Promise.all([
      parseCustomObjectComponent(path.join(baseDir, 'objects', 'Invoice__c')),
      parseCustomMetadataComponents(path.join(baseDir, 'customMetadata', 'RoutingConfig__mdt')),
    ]);

    expect(customObject).to.exist;
    expect(customObject?.name).to.equal('Invoice__c');
    expect(customObject?.type).to.equal('CustomObject');
    expect([...customObject!.dependencies]).to.have.members(['Account', 'Invoice__c']);

    expect(customMetadataComponents).to.have.lengthOf(2);

    const customMetadataType = customMetadataComponents.find((component) => component.type === 'CustomMetadata');
    const customMetadataRecord = customMetadataComponents.find(
      (component) => component.type === 'CustomMetadataRecord'
    );

    expect(customMetadataType).to.exist;
    expect(customMetadataType?.name).to.equal('RoutingConfig__mdt');
    expect([...customMetadataType!.dependencies]).to.have.members([
      'Group',
      'CustomMetadataRecord:RoutingConfig__mdt.Default',
    ]);

    expect(customMetadataRecord).to.exist;
    expect(customMetadataRecord?.name).to.equal('RoutingConfig__mdt.Default');
    expect([...customMetadataRecord!.dependencies]).to.have.members(['CustomMetadata:RoutingConfig__mdt']);
  });
});
