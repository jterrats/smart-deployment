/**
 * Tests for Data Provisioner - US-107
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DataProvisioner } from '../../../src/provisioning/data-provisioner.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('DataProvisioner', () => {
  const provisioner = new DataProvisioner();

  describe('US-107: Data Provisioning Between Waves', () => {
    /** @ac US-107-AC-1: Detect when data provisioning is needed */
    it('US-107-AC-1: should detect when data provisioning is needed', () => {
      const components: MetadataComponent[] = [
        {
          name: 'TestCMT__mdt',
          type: 'CustomMetadata',
          filePath: 'force-app/main/default/customMetadata/TestCMT.TestCMT.md-meta.xml',
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
        {
          name: 'TestSettings__c',
          type: 'CustomSetting',
          filePath: 'force-app/main/default/objects/TestSettings__c',
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ];

      const records = provisioner.detectProvisioningNeeds(components);

      expect(records).to.have.length.greaterThan(0);
      expect(records.some((r) => r.type === 'CustomMetadata')).to.be.true;
    });

    /** @ac US-107-AC-2: Support Custom Metadata Type record creation */
    it('US-107-AC-2: should parse Custom Metadata records', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Test CMT</label>
    <protected>false</protected>
</CustomMetadata>`;

      // Create temporary file
      const { promises: fs } = await import('node:fs');
      const { join } = await import('node:path');
      const testFile = join(process.cwd(), 'test-temp', 'TestCMT.md-meta.xml');
      await fs.mkdir(join(process.cwd(), 'test-temp'), { recursive: true });
      await fs.writeFile(testFile, xmlContent, 'utf-8');

      const record = await provisioner.parseCustomMetadataRecord(testFile);

      expect(record.type).to.equal('CustomMetadata');
      expect(record.name).to.equal('TestCMT');
      expect(record.filePath).to.equal(testFile);

      // Cleanup
      await fs.rm(join(process.cwd(), 'test-temp'), { recursive: true, force: true });
    });

    /** @ac US-107-AC-3: Handle Custom Settings data */
    it('US-107-AC-3: should prepare Custom Settings data', () => {
      const component: MetadataComponent = {
        name: 'TestSettings__c',
        type: 'CustomSetting',
        filePath: 'force-app/main/default/objects/TestSettings__c',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };

      const data = {
        Name: 'Test Setting',
        Value__c: 'Test Value',
      };

      const record = provisioner.prepareCustomSettingsData(component, data);

      expect(record.type).to.equal('CustomSettings');
      expect(record.name).to.equal('TestSettings__c');
      expect(record.metadata).to.deep.equal(data);
    });

    /** @ac US-107-AC-4: Queue data operations between waves */
    it('US-107-AC-4: should create data provisioning wave', () => {
      const records = [
        {
          type: 'CustomMetadata' as const,
          name: 'TestCMT',
          filePath: 'test.md-meta.xml',
          metadata: {},
          dependsOn: [],
        },
      ];

      const wave = provisioner.createProvisioningWave(records, 2);

      expect(wave.waveNumber).to.equal(2);
      expect(wave.records).to.deep.equal(records);
      expect(wave.estimatedTime).to.be.greaterThan(0);
      expect(wave.dependencies).to.be.an('array');
    });

    /** @ac US-107-AC-5: Validate data exists before deploying dependent metadata */
    it('US-107-AC-5: should validate data exists', async () => {
      const records = [
        {
          type: 'CustomMetadata' as const,
          name: 'TestCMT.TestCMT',
          filePath: 'test.md-meta.xml',
          metadata: {},
          dependsOn: [],
        },
      ];

      const mockOrgApi = {
        query: async (_soql: string) => [],
      };

      const result = await provisioner.validateDataExists(records, mockOrgApi);

      expect(result).to.have.property('valid');
      expect(result).to.have.property('missing');
      expect(result.missing).to.be.an('array');
    });

    it('should execute data provisioning', async () => {
      const wave = {
        waveNumber: 1,
        records: [
          {
            type: 'CustomMetadata' as const,
            name: 'TestCMT',
            filePath: 'test.md-meta.xml',
            metadata: {},
            dependsOn: [],
          },
        ],
        estimatedTime: 1000,
        dependencies: [],
      };

      const mockOrgApi = {
        create: async (_type: string, records: unknown[]) =>
          records.map(() => ({ id: '001000000000000AAA' })),
      };

      const result = await provisioner.executeProvisioning(wave, mockOrgApi);

      expect(result).to.have.property('success');
      expect(result).to.have.property('recordsCreated');
      expect(result).to.have.property('recordsFailed');
      expect(result).to.have.property('errors');
      expect(result).to.have.property('executionTime');
    });

    it('should format provisioning report', async () => {
      const result = {
        success: true,
        recordsCreated: 5,
        recordsFailed: 0,
        errors: [],
        executionTime: 5000,
      };

      const report = provisioner.formatReport(result);

      expect(report).to.be.a('string');
      expect(report).to.include('Data Provisioning Report');
      expect(report).to.include('SUCCESS');
      expect(report).to.include('Records Created: 5');
    });
  });
});

