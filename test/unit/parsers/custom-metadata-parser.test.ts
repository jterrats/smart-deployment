import { expect } from 'chai';
import {
  parseCustomMetadataType,
  parseCustomMetadataRecord,
  groupCustomMetadataWithRecords,
} from '../../../src/parsers/custom-metadata-parser.js';

describe('Custom Metadata Parser', () => {
  describe('Custom Metadata Type Parsing', () => {
    /**
     * @ac US-026-AC-1: Extract field definitions
     */
    it('should parse custom metadata type with fields', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>My Config</label>
          <pluralLabel>My Configs</pluralLabel>
          <description>Configuration settings</description>
          <fields>
            <fullName>Value__c</fullName>
            <label>Value</label>
            <type>Text</type>
            <required>true</required>
          </fields>
          <fields>
            <fullName>IsActive__c</fullName>
            <label>Is Active</label>
            <type>Checkbox</type>
          </fields>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataType('MyConfig__mdt', metadata);

      expect(result.typeName).to.equal('MyConfig__mdt');
      expect(result.label).to.equal('My Config');
      expect(result.pluralLabel).to.equal('My Configs');
      expect(result.description).to.equal('Configuration settings');
      expect(result.fields).to.have.lengthOf(2);
      expect(result.fields[0].fullName).to.equal('Value__c');
      expect(result.fields[0].type).to.equal('Text');
      expect(result.fields[0].required).to.be.true;
      expect(result.fields[1].fullName).to.equal('IsActive__c');
      expect(result.fields[1].type).to.equal('Checkbox');
    });

    it('should handle custom metadata type with single field', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Simple Config</label>
          <pluralLabel>Simple Configs</pluralLabel>
          <fields>
            <fullName>Value__c</fullName>
            <label>Value</label>
            <type>Text</type>
          </fields>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataType('SimpleConfig__mdt', metadata);

      expect(result.fields).to.have.lengthOf(1);
      expect(result.fields[0].fullName).to.equal('Value__c');
    });

    it('should handle custom metadata type with no fields', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Empty Config</label>
          <pluralLabel>Empty Configs</pluralLabel>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataType('EmptyConfig__mdt', metadata);

      expect(result.fields).to.be.an('array').that.is.empty;
    });

    /**
     * @ac US-026-AC-2: Extract relationship references
     */
    it('should extract EntityDefinition relationship references', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Object Config</label>
          <pluralLabel>Object Configs</pluralLabel>
          <fields>
            <fullName>ObjectType__c</fullName>
            <label>Object Type</label>
            <type>MetadataRelationship</type>
            <referenceTo>EntityDefinition</referenceTo>
          </fields>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataType('ObjectConfig__mdt', metadata);

      expect(result.fields[0].referenceTo).to.equal('EntityDefinition');

      const relationshipDeps = result.dependencies.filter((d) => d.type === 'relationship_field');
      expect(relationshipDeps).to.have.lengthOf(1);
      expect(relationshipDeps[0].referencedObject).to.equal('EntityDefinition');
      expect(relationshipDeps[0].fieldName).to.equal('ObjectType__c');
    });

    it('should handle multiple relationship fields', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Multi Ref Config</label>
          <pluralLabel>Multi Ref Configs</pluralLabel>
          <fields>
            <fullName>ObjectType__c</fullName>
            <label>Object Type</label>
            <type>MetadataRelationship</type>
            <referenceTo>EntityDefinition</referenceTo>
          </fields>
          <fields>
            <fullName>FieldDefinition__c</fullName>
            <label>Field Definition</label>
            <type>MetadataRelationship</type>
            <referenceTo>FieldDefinition</referenceTo>
          </fields>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataType('MultiRefConfig__mdt', metadata);

      const relationshipDeps = result.dependencies.filter((d) => d.type === 'relationship_field');
      expect(relationshipDeps).to.have.lengthOf(2);
      expect(relationshipDeps[0].referencedObject).to.equal('EntityDefinition');
      expect(relationshipDeps[1].referencedObject).to.equal('FieldDefinition');
    });
  });

  describe('Custom Metadata Record Parsing', () => {
    /**
     * @ac US-026-AC-4: Identify CMT records separately
     */
    it('should parse custom metadata record', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Default Config</label>
          <protected>true</protected>
          <values>
            <field>Value__c</field>
            <value>Default Value</value>
          </values>
          <values>
            <field>IsActive__c</field>
            <value>true</value>
          </values>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataRecord('MyConfig.Default', metadata);

      expect(result.fullName).to.equal('MyConfig.Default');
      expect(result.label).to.equal('Default Config');
      expect(result.protected).to.be.true;
      expect(result.values).to.have.property('Value__c');
      expect(result.values['Value__c']).to.equal('Default Value');
      expect(result.values['IsActive__c']).to.equal(true); // XML parser converts "true" to boolean
    });

    it('should handle record with single value', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Single Value</label>
          <values>
            <field>Value__c</field>
            <value>Test</value>
          </values>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataRecord('Config.Single', metadata);

      expect(result.values).to.have.property('Value__c');
      expect(result.values['Value__c']).to.equal('Test');
      expect(Object.keys(result.values)).to.have.lengthOf(1);
    });

    it('should handle record with no values', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Empty Record</label>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataRecord('Config.Empty', metadata);

      expect(result.values).to.be.an('object').that.is.empty;
    });

    it('should handle unprotected records', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Unprotected</label>
          <protected>false</protected>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataRecord('Config.Unprotected', metadata);

      expect(result.protected).to.be.false;
    });
  });

  describe('Grouping Type with Records', () => {
    /**
     * @ac US-026-AC-3: Group type with records
     */
    it('should group custom metadata type with records', async () => {
      const typeMetadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Config</label>
          <pluralLabel>Configs</pluralLabel>
          <fields>
            <fullName>Value__c</fullName>
            <label>Value</label>
            <type>Text</type>
          </fields>
        </CustomMetadata>
      `;

      const record1Metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Record 1</label>
          <values>
            <field>Value__c</field>
            <value>Value 1</value>
          </values>
        </CustomMetadata>
      `;

      const record2Metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Record 2</label>
          <values>
            <field>Value__c</field>
            <value>Value 2</value>
          </values>
        </CustomMetadata>
      `;

      const typeResult = await parseCustomMetadataType('Config__mdt', typeMetadata);
      const record1 = await parseCustomMetadataRecord('Config.Record1', record1Metadata);
      const record2 = await parseCustomMetadataRecord('Config.Record2', record2Metadata);

      const grouped = groupCustomMetadataWithRecords(typeResult, [record1, record2]);

      expect(grouped.records).to.have.lengthOf(2);
      expect(grouped.records[0].fullName).to.equal('Config.Record1');
      expect(grouped.records[1].fullName).to.equal('Config.Record2');
      expect(grouped.requiresSplitting).to.be.false;
    });

    /**
     * @ac US-026-AC-5: Handle CMT splitting (200 records/wave)
     */
    it('should detect when splitting is NOT required (<= 200 records)', async () => {
      const typeMetadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Small Config</label>
          <pluralLabel>Small Configs</pluralLabel>
        </CustomMetadata>
      `;

      const typeResult = await parseCustomMetadataType('SmallConfig__mdt', typeMetadata);

      // Create 200 records (exactly at limit)
      const records = Array.from({ length: 200 }, (_, i) => ({
        fullName: `SmallConfig.Record${i + 1}`,
        label: `Record ${i + 1}`,
        values: {},
      }));

      const grouped = groupCustomMetadataWithRecords(typeResult, records);

      expect(grouped.records).to.have.lengthOf(200);
      expect(grouped.requiresSplitting).to.be.false;
      expect(grouped.splitBatches).to.be.undefined;
    });

    it('should detect when splitting IS required (> 200 records)', async () => {
      const typeMetadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Large Config</label>
          <pluralLabel>Large Configs</pluralLabel>
        </CustomMetadata>
      `;

      const typeResult = await parseCustomMetadataType('LargeConfig__mdt', typeMetadata);

      // Create 250 records (exceeds limit)
      const records = Array.from({ length: 250 }, (_, i) => ({
        fullName: `LargeConfig.Record${i + 1}`,
        label: `Record ${i + 1}`,
        values: {},
      }));

      const grouped = groupCustomMetadataWithRecords(typeResult, records);

      expect(grouped.records).to.have.lengthOf(250);
      expect(grouped.requiresSplitting).to.be.true;
      expect(grouped.splitBatches).to.equal(2); // 250 / 200 = 1.25 -> ceil = 2
    });

    it('should calculate correct number of split batches', async () => {
      const typeMetadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Huge Config</label>
          <pluralLabel>Huge Configs</pluralLabel>
        </CustomMetadata>
      `;

      const typeResult = await parseCustomMetadataType('HugeConfig__mdt', typeMetadata);

      // Create 500 records
      const records = Array.from({ length: 500 }, (_, i) => ({
        fullName: `HugeConfig.Record${i + 1}`,
        label: `Record ${i + 1}`,
        values: {},
      }));

      const grouped = groupCustomMetadataWithRecords(typeResult, records);

      expect(grouped.requiresSplitting).to.be.true;
      expect(grouped.splitBatches).to.equal(3); // 500 / 200 = 2.5 -> ceil = 3
    });

    it('should add record dependencies when grouping', async () => {
      const typeMetadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Config</label>
          <pluralLabel>Configs</pluralLabel>
        </CustomMetadata>
      `;

      const typeResult = await parseCustomMetadataType('Config__mdt', typeMetadata);
      const records = [
        { fullName: 'Config.Record1', label: 'Record 1', values: {} },
        { fullName: 'Config.Record2', label: 'Record 2', values: {} },
      ];

      const grouped = groupCustomMetadataWithRecords(typeResult, records);

      const recordDeps = grouped.dependencies.filter((d) => d.type === 'record');
      expect(recordDeps).to.have.lengthOf(2);
      expect(recordDeps[0].name).to.equal('Config.Record1');
      expect(recordDeps[1].name).to.equal('Config.Record2');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed XML gracefully', async () => {
      const metadata = '<CustomMetadata><unclosed>';

      try {
        await parseCustomMetadataType('Bad__mdt', metadata);
        expect.fail('Should have thrown ParsingError');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('should handle empty metadata', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataType('Empty__mdt', metadata);

      expect(result.typeName).to.equal('Empty__mdt');
      expect(result.fields).to.be.empty;
      expect(result.records).to.be.empty;
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse comprehensive custom metadata type', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>API Configuration</label>
          <pluralLabel>API Configurations</pluralLabel>
          <description>Configuration for external API integrations</description>
          <fields>
            <fullName>Endpoint__c</fullName>
            <label>Endpoint URL</label>
            <type>Url</type>
            <required>true</required>
          </fields>
          <fields>
            <fullName>Timeout__c</fullName>
            <label>Timeout (ms)</label>
            <type>Number</type>
          </fields>
          <fields>
            <fullName>IsActive__c</fullName>
            <label>Is Active</label>
            <type>Checkbox</type>
          </fields>
          <fields>
            <fullName>TargetObject__c</fullName>
            <label>Target Object</label>
            <type>MetadataRelationship</type>
            <referenceTo>EntityDefinition</referenceTo>
          </fields>
        </CustomMetadata>
      `;

      const result = await parseCustomMetadataType('APIConfig__mdt', metadata);

      expect(result.typeName).to.equal('APIConfig__mdt');
      expect(result.label).to.equal('API Configuration');
      expect(result.description).to.equal('Configuration for external API integrations');
      expect(result.fields).to.have.lengthOf(4);

      const relationshipDeps = result.dependencies.filter((d) => d.type === 'relationship_field');
      expect(relationshipDeps).to.have.lengthOf(1);
      expect(relationshipDeps[0].referencedObject).to.equal('EntityDefinition');
    });
  });
});
