import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseCustomObject } from '../../../src/parsers/custom-object-parser.js';

describe('Custom Object Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple custom object', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>My Object</label>
          <pluralLabel>My Objects</pluralLabel>
          <deploymentStatus>Deployed</deploymentStatus>
          <sharingModel>ReadWrite</sharingModel>
        </CustomObject>
      `;

      const result = await parseCustomObject('MyObject__c', metadata);

      expect(result.label).to.equal('My Object');
      expect(result.pluralLabel).to.equal('My Objects');
      expect(result.fields).to.be.an('array');
      expect(result.dependencies).to.be.an('array');
    });
  });

  describe('Custom Field Extraction', () => {
    /**
     * @ac US-020-AC-1: Extract custom field definitions
     */
    it('should extract custom fields', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Account Custom</label>
          <pluralLabel>Accounts Custom</pluralLabel>
          <fields>
            <fullName>CustomField__c</fullName>
            <label>Custom Field</label>
            <type>Text</type>
            <length>255</length>
          </fields>
          <fields>
            <fullName>AnotherField__c</fullName>
            <label>Another Field</label>
            <type>Number</type>
            <precision>18</precision>
            <scale>2</scale>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Account', metadata);

      expect(result.fields).to.have.lengthOf(2);
      expect(result.fields[0].fullName).to.equal('CustomField__c');
      expect(result.fields[0].type).to.equal('Text');
      expect(result.fields[1].fullName).to.equal('AnotherField__c');
      expect(result.fields[1].type).to.equal('Number');
    });

    it('should extract field metadata', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>RequiredField__c</fullName>
            <label>Required Field</label>
            <type>Text</type>
            <required>true</required>
            <unique>true</unique>
            <externalId>true</externalId>
            <trackHistory>true</trackHistory>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const field = result.fields[0];
      expect(field.required).to.be.true;
      expect(field.unique).to.be.true;
      expect(field.externalId).to.be.true;
      expect(field.trackHistory).to.be.true;
    });
  });

  describe('Validation Rules', () => {
    /**
     * @ac US-020-AC-2: Extract validation rule dependencies
     */
    it('should extract validation rules', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <validationRules>
            <fullName>Check_Status</fullName>
            <active>true</active>
            <errorConditionFormula>Status__c = "Invalid"</errorConditionFormula>
            <errorMessage>Invalid status</errorMessage>
          </validationRules>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      expect(result.validationRules).to.have.lengthOf(1);
      expect(result.validationRules[0].fullName).to.equal('Check_Status');
      expect(result.validationRules[0].active).to.be.true;
      expect(result.validationRules[0].errorConditionFormula).to.include('Status__c');
    });

    it('should extract validation rule dependencies', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <validationRules>
            <fullName>Check_Account</fullName>
            <active>true</active>
            <errorConditionFormula>Account.Type = "Prospect"</errorConditionFormula>
          </validationRules>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const validationDeps = result.dependencies.filter((d) => d.type === 'validation_rule');
      expect(validationDeps.length).to.be.greaterThan(0);
      expect(validationDeps[0].referencedObject).to.equal('Account');
    });
  });

  describe('Formula Field Dependencies', () => {
    /**
     * @ac US-020-AC-3: Extract formula field dependencies
     */
    it('should extract formula field object references', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>AccountName__c</fullName>
            <label>Account Name</label>
            <type>Text</type>
            <formula>Account.Name</formula>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const formulaDeps = result.dependencies.filter((d) => d.type === 'formula_field');
      expect(formulaDeps.length).to.be.greaterThan(0);
      expect(formulaDeps[0].referencedObject).to.equal('Account');
    });

    it('should extract $ObjectType references', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>ObjectTypeRef__c</fullName>
            <label>Object Type</label>
            <type>Text</type>
            <formula>$ObjectType.Contact.Name</formula>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const formulaDeps = result.dependencies.filter((d) => d.type === 'formula_field');
      expect(formulaDeps.some((d) => d.referencedObject === 'Contact')).to.be.true;
    });

    it('should resolve custom relationship traversals to their referenced object and field dependency', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Invoice</label>
          <pluralLabel>Invoices</pluralLabel>
          <fields>
            <fullName>Account__c</fullName>
            <label>Account</label>
            <type>Lookup</type>
            <referenceTo>Account</referenceTo>
            <relationshipName>Account</relationshipName>
          </fields>
          <fields>
            <fullName>AccountName__c</fullName>
            <label>Account Name</label>
            <type>Text</type>
            <formula>Account__r.Name</formula>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Invoice__c', metadata);

      const formulaDeps = result.dependencies.filter((d) => d.type === 'formula_field');
      const customFieldDeps = result.dependencies.filter((d) => d.type === 'custom_field');
      expect(formulaDeps.some((d) => d.referencedObject === 'Account')).to.be.true;
      expect(customFieldDeps.some((d) => d.name === 'Account__c')).to.be.true;
    });

    it('should ignore standard formula functions', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>FormulaWithFunctions__c</fullName>
            <label>Formula</label>
            <type>Text</type>
            <formula>IF(TODAY() > DATE(2024, 1, 1), "New", "Old")</formula>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const formulaDeps = result.dependencies.filter((d) => d.type === 'formula_field');
      // Should not extract IF, TODAY, DATE as object references
      expect(formulaDeps.some((d) => d.referencedObject === 'IF')).to.be.false;
      expect(formulaDeps.some((d) => d.referencedObject === 'TODAY')).to.be.false;
      expect(formulaDeps.some((d) => d.referencedObject === 'DATE')).to.be.false;
    });
  });

  describe('Relationship Fields', () => {
    /**
     * @ac US-020-AC-4: Extract lookup/master-detail relationships
     */
    it('should extract lookup relationships', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>AccountLookup__c</fullName>
            <label>Account</label>
            <type>Lookup</type>
            <referenceTo>Account</referenceTo>
            <relationshipName>Accounts</relationshipName>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const lookupDeps = result.dependencies.filter((d) => d.type === 'lookup_field');
      expect(lookupDeps).to.have.lengthOf(1);
      expect(lookupDeps[0].referencedObject).to.equal('Account');
      expect(lookupDeps[0].fieldName).to.equal('AccountLookup__c');
    });

    it('should extract master-detail relationships', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>ParentRecord__c</fullName>
            <label>Parent</label>
            <type>MasterDetail</type>
            <referenceTo>Account</referenceTo>
            <relationshipName>Children</relationshipName>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const mdDeps = result.dependencies.filter((d) => d.type === 'master_detail_field');
      expect(mdDeps).to.have.lengthOf(1);
      expect(mdDeps[0].referencedObject).to.equal('Account');
    });

    it('should handle polymorphic lookups', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>PolyLookup__c</fullName>
            <label>Polymorphic</label>
            <type>Lookup</type>
            <referenceTo>Account</referenceTo>
            <referenceTo>Contact</referenceTo>
            <relationshipName>PolyRecords</relationshipName>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const lookupDeps = result.dependencies.filter((d) => d.type === 'lookup_field');
      expect(lookupDeps).to.have.lengthOf(2);
      expect(lookupDeps.map((d) => d.referencedObject)).to.include.members(['Account', 'Contact']);
    });
  });

  describe('Derived Field Dependencies', () => {
    it('should extract custom field dependencies from roll-up summary fields', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Invoice</label>
          <pluralLabel>Invoices</pluralLabel>
          <fields>
            <fullName>Amount__c</fullName>
            <label>Amount</label>
            <type>Currency</type>
            <precision>18</precision>
            <scale>2</scale>
          </fields>
          <fields>
            <fullName>LineItems__c</fullName>
            <label>Line Items</label>
            <type>MasterDetail</type>
            <referenceTo>Invoice_Line_Item__c</referenceTo>
            <relationshipName>LineItems</relationshipName>
          </fields>
          <fields>
            <fullName>TotalAmount__c</fullName>
            <label>Total Amount</label>
            <type>Summary</type>
            <summaryForeignKey>LineItems__c</summaryForeignKey>
            <summarizedField>Amount__c</summarizedField>
            <summaryOperation>sum</summaryOperation>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Invoice__c', metadata);

      const customFieldDeps = result.dependencies.filter((d) => d.type === 'custom_field');
      expect(customFieldDeps.map((d) => d.name)).to.include.members(['LineItems__c', 'Amount__c']);
    });

    it('should extract custom field dependencies from validation rules', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Order</label>
          <pluralLabel>Orders</pluralLabel>
          <fields>
            <fullName>Status__c</fullName>
            <label>Status</label>
            <type>Text</type>
            <length>20</length>
          </fields>
          <validationRules>
            <fullName>Requires_Status</fullName>
            <active>true</active>
            <errorConditionFormula>ISBLANK(Status__c)</errorConditionFormula>
          </validationRules>
        </CustomObject>
      `;

      const result = await parseCustomObject('Order__c', metadata);

      const customFieldDeps = result.dependencies.filter((d) => d.type === 'custom_field');
      expect(customFieldDeps.some((d) => d.name === 'Status__c')).to.be.true;
    });
  });

  describe('Apex Class References', () => {
    /**
     * @ac US-020-AC-5: Extract Apex class references in formulas
     */
    it('should extract Apex class from formula', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <fields>
            <fullName>FormulaWithApex__c</fullName>
            <label>Formula</label>
            <type>Text</type>
            <formula>MyUtilityClass.calculateValue()</formula>
          </fields>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const apexDeps = result.dependencies.filter((d) => d.type === 'apex_class');
      expect(apexDeps.length).to.be.greaterThan(0);
      expect(apexDeps[0].name).to.equal('MyUtilityClass');
    });

    it('should extract Apex class from validation rule', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <validationRules>
            <fullName>ValidateWithApex</fullName>
            <active>true</active>
            <errorConditionFormula>ValidationHelper.isInvalid()</errorConditionFormula>
          </validationRules>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const apexDeps = result.dependencies.filter((d) => d.type === 'apex_class');
      expect(apexDeps.length).to.be.greaterThan(0);
      expect(apexDeps[0].name).to.equal('ValidationHelper');
    });
  });

  describe('Record Types', () => {
    /**
     * @ac US-020-AC-6: Extract record types
     */
    it('should extract record types', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <recordTypes>
            <fullName>Standard</fullName>
            <label>Standard Record Type</label>
            <active>true</active>
          </recordTypes>
          <recordTypes>
            <fullName>Premium</fullName>
            <label>Premium Record Type</label>
            <active>true</active>
            <description>For premium customers</description>
          </recordTypes>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      expect(result.recordTypes).to.have.lengthOf(2);
      expect(result.recordTypes[0].fullName).to.equal('Standard');
      expect(result.recordTypes[1].fullName).to.equal('Premium');
      expect(result.recordTypes[1].description).to.equal('For premium customers');
    });

    it('should create record type dependencies', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <recordTypes>
            <fullName>Type1</fullName>
            <label>Type 1</label>
            <active>true</active>
          </recordTypes>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      const rtDeps = result.dependencies.filter((d) => d.type === 'record_type');
      expect(rtDeps).to.have.lengthOf(1);
      expect(rtDeps[0].name).to.equal('Type1');
    });
  });

  describe('Sharing Rules', () => {
    /**
     * @ac US-020-AC-7: Extract sharing rules
     */
    it('should extract criteria-based sharing rules', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <sharingRules>
            <criteriaBasedRules>
              <fullName>Share_With_Sales</fullName>
              <accessLevel>Read</accessLevel>
              <sharedTo>
                <group>Sales_Team</group>
              </sharedTo>
            </criteriaBasedRules>
          </sharingRules>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      expect(result.sharingRules).to.have.lengthOf(1);
      expect(result.sharingRules[0].fullName).to.equal('Share_With_Sales');
      expect(result.sharingRules[0].accessLevel).to.equal('Read');
    });

    it('should extract owner-based sharing rules', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <sharingRules>
            <ownerRules>
              <fullName>Share_With_Managers</fullName>
              <accessLevel>Edit</accessLevel>
              <sharedTo>
                <role>Manager</role>
              </sharedTo>
            </ownerRules>
          </sharingRules>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      expect(result.sharingRules).to.have.lengthOf(1);
      expect(result.sharingRules[0].fullName).to.equal('Share_With_Managers');
    });

    it('should extract multiple sharing rules', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <sharingRules>
            <criteriaBasedRules>
              <fullName>Rule1</fullName>
              <accessLevel>Read</accessLevel>
            </criteriaBasedRules>
            <criteriaBasedRules>
              <fullName>Rule2</fullName>
              <accessLevel>Edit</accessLevel>
            </criteriaBasedRules>
            <ownerRules>
              <fullName>OwnerRule1</fullName>
              <accessLevel>Read</accessLevel>
            </ownerRules>
          </sharingRules>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      expect(result.sharingRules).to.have.lengthOf(3);
    });
  });

  describe('List Views', () => {
    /**
     * @ac US-020-AC-8: Extract list views
     */
    it('should extract list views', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Test</label>
          <pluralLabel>Tests</pluralLabel>
          <listViews>
            <fullName>All_Records</fullName>
            <label>All Records</label>
            <filterScope>Everything</filterScope>
          </listViews>
          <listViews>
            <fullName>Active_Only</fullName>
            <label>Active Only</label>
            <filterScope>Mine</filterScope>
          </listViews>
        </CustomObject>
      `;

      const result = await parseCustomObject('Test__c', metadata);

      expect(result.listViews).to.have.lengthOf(2);
      expect(result.listViews[0].fullName).to.equal('All_Records');
      expect(result.listViews[1].fullName).to.equal('Active_Only');
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a comprehensive custom object', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Order</label>
          <pluralLabel>Orders</pluralLabel>
          <deploymentStatus>Deployed</deploymentStatus>
          <sharingModel>ReadWrite</sharingModel>
          <enableHistory>true</enableHistory>
          <enableReports>true</enableReports>
          <fields>
            <fullName>Account__c</fullName>
            <label>Account</label>
            <type>Lookup</type>
            <referenceTo>Account</referenceTo>
            <relationshipName>Orders</relationshipName>
          </fields>
          <fields>
            <fullName>TotalAmount__c</fullName>
            <label>Total Amount</label>
            <type>Currency</type>
            <precision>18</precision>
            <scale>2</scale>
          </fields>
          <fields>
            <fullName>AccountName__c</fullName>
            <label>Account Name</label>
            <type>Text</type>
            <formula>Account__r.Name</formula>
          </fields>
          <validationRules>
            <fullName>Amount_Must_Be_Positive</fullName>
            <active>true</active>
            <errorConditionFormula>TotalAmount__c &lt; 0</errorConditionFormula>
            <errorMessage>Amount must be positive</errorMessage>
          </validationRules>
          <recordTypes>
            <fullName>Standard</fullName>
            <label>Standard</label>
            <active>true</active>
          </recordTypes>
          <listViews>
            <fullName>All</fullName>
            <label>All Orders</label>
            <filterScope>Everything</filterScope>
          </listViews>
        </CustomObject>
      `;

      const result = await parseCustomObject('Order__c', metadata);

      expect(result.label).to.equal('Order');
      expect(result.fields).to.have.lengthOf(3);
      expect(result.validationRules).to.have.lengthOf(1);
      expect(result.recordTypes).to.have.lengthOf(1);
      expect(result.listViews).to.have.lengthOf(1);

      // Check dependencies
      expect(result.dependencies.some((d) => d.type === 'lookup_field')).to.be.true;
      expect(result.dependencies.some((d) => d.type === 'formula_field')).to.be.true;
      expect(result.dependencies.some((d) => d.type === 'record_type')).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed XML gracefully', async () => {
      const metadata = '<CustomObject><unclosed>';

      try {
        await parseCustomObject('Bad__c', metadata);
        expect.fail('Should have thrown ParsingError');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('should handle empty custom object', async () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
          <label>Empty</label>
          <pluralLabel>Empties</pluralLabel>
        </CustomObject>
      `;

      const result = await parseCustomObject('Empty__c', metadata);

      expect(result.fields).to.be.empty;
      expect(result.validationRules).to.be.empty;
      expect(result.recordTypes).to.be.empty;
    });
  });
});
