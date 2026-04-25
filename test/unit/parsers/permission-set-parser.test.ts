/**
 * Unit tests for Permission Set Parser
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parsePermissionSet } from '../../../src/parsers/permission-set-parser.js';

describe('Permission Set Parser', () => {
  const testDir = join(process.cwd(), '.tmp-test-permission-set-parser');

  before(async () => {
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('parsePermissionSet', () => {
    it('should parse basic permission set metadata (AC-1)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Permission set for sales users</description>
    <hasActivationRequired>false</hasActivationRequired>
    <label>Sales User</label>
    <license>Salesforce</license>
</PermissionSet>`;

      const filePath = join(testDir, 'Sales_User.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Sales_User');

      expect(result.name).to.equal('Sales_User');
      expect(result.label).to.equal('Sales User');
      expect(result.description).to.equal('Permission set for sales users');
      expect(result.hasActivationRequired).to.equal(false);
      expect(result.license).to.equal('Salesforce');
    });

    it('should extract object permissions (AC-2)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Sales Objects Access</label>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Opportunity</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
</PermissionSet>`;

      const filePath = join(testDir, 'Sales_Objects.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Sales_Objects');

      expect(result.objectPermissions).to.be.an('array').with.lengthOf(3);
      expect(result.objectPermissions).to.include.members(['Account', 'Contact', 'Opportunity']);
      expect(result.dependencies.objects).to.deep.equal(['Account', 'Contact', 'Opportunity']);
    });

    it('should ignore object permissions without any granted access', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Filtered Objects</label>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>false</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowRead>true</allowRead>
        <object>Contact</object>
    </objectPermissions>
</PermissionSet>`;

      const filePath = join(testDir, 'Filtered_Objects.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Filtered_Objects');

      expect(result.objectPermissions).to.deep.equal(['Contact']);
      expect(result.dependencies.objects).to.deep.equal(['Contact']);
    });

    it('should extract field-level security permissions (AC-3)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Sales FLS</label>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Industry</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Revenue</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.Amount</field>
        <readable>true</readable>
    </fieldPermissions>
</PermissionSet>`;

      const filePath = join(testDir, 'Sales_FLS.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Sales_FLS');

      expect(result.fieldPermissions).to.be.an('array').with.lengthOf(3);
      expect(result.fieldPermissions).to.include.members(['Account.Industry', 'Account.Revenue', 'Opportunity.Amount']);
      expect(result.dependencies.fields).to.deep.equal(['Account.Industry', 'Account.Revenue', 'Opportunity.Amount']);
    });

    it('should extract Apex class access permissions (AC-4)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Apex Access</label>
    <classAccesses>
        <apexClass>AccountService</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>OpportunityHandler</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>ContactTriggerHandler</apexClass>
        <enabled>true</enabled>
    </classAccesses>
</PermissionSet>`;

      const filePath = join(testDir, 'Apex_Access.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Apex_Access');

      expect(result.apexClassAccesses).to.be.an('array').with.lengthOf(3);
      expect(result.apexClassAccesses).to.include.members([
        'AccountService',
        'OpportunityHandler',
        'ContactTriggerHandler',
      ]);
      expect(result.dependencies.apexClasses).to.deep.equal([
        'AccountService',
        'OpportunityHandler',
        'ContactTriggerHandler',
      ]);
    });

    it('should include only enabled and visible permission set references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Enabled Only</label>
    <classAccesses>
        <apexClass>EnabledClass</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>DisabledClass</apexClass>
        <enabled>false</enabled>
    </classAccesses>
    <pageAccesses>
        <apexPage>EnabledPage</apexPage>
        <enabled>true</enabled>
    </pageAccesses>
    <pageAccesses>
        <apexPage>DisabledPage</apexPage>
        <enabled>false</enabled>
    </pageAccesses>
    <applicationVisibilities>
        <application>Sales</application>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>Marketing</application>
        <visible>false</visible>
    </applicationVisibilities>
    <tabSettings>
        <tab>standard-Account</tab>
        <visibility>Visible</visibility>
    </tabSettings>
    <tabSettings>
        <tab>standard-Contact</tab>
        <visibility>None</visibility>
    </tabSettings>
</PermissionSet>`;

      const filePath = join(testDir, 'Enabled_Only.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Enabled_Only');

      expect(result.apexClassAccesses).to.deep.equal(['EnabledClass']);
      expect(result.visualforcePageAccesses).to.deep.equal(['EnabledPage']);
      expect(result.applicationVisibilities).to.deep.equal(['Sales']);
      expect(result.tabSettings).to.deep.equal(['standard-Account']);
      expect(result.optionalDependencies).to.deep.equal({
        visualforcePages: ['EnabledPage'],
        applications: ['Sales'],
        tabs: ['standard-Account'],
      });
    });

    it('should extract Visualforce page access permissions (AC-5)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>VF Page Access</label>
    <pageAccesses>
        <apexPage>AccountDashboard</apexPage>
        <enabled>true</enabled>
    </pageAccesses>
    <pageAccesses>
        <apexPage>OpportunityReport</apexPage>
        <enabled>true</enabled>
    </pageAccesses>
</PermissionSet>`;

      const filePath = join(testDir, 'VF_Access.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'VF_Access');

      expect(result.visualforcePageAccesses).to.be.an('array').with.lengthOf(2);
      expect(result.visualforcePageAccesses).to.include.members(['AccountDashboard', 'OpportunityReport']);
      expect(result.dependencies.visualforcePages).to.deep.equal(['AccountDashboard', 'OpportunityReport']);
    });

    it('should extract custom permission references (AC-6)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Custom Permissions</label>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanApproveDiscounts</name>
    </customPermissions>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanOverridePrice</name>
    </customPermissions>
    <customPermissions>
        <enabled>false</enabled>
        <name>CanDeleteRecords</name>
    </customPermissions>
</PermissionSet>`;

      const filePath = join(testDir, 'Custom_Perms.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Custom_Perms');

      // Only enabled custom permissions should be extracted
      expect(result.customPermissions).to.be.an('array').with.lengthOf(2);
      expect(result.customPermissions).to.include.members(['CanApproveDiscounts', 'CanOverridePrice']);
      expect(result.customPermissions).to.not.include('CanDeleteRecords');
      expect(result.dependencies.customPermissions).to.deep.equal(['CanApproveDiscounts', 'CanOverridePrice']);
    });

    it('should extract application visibility settings (AC-7)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>App Visibility</label>
    <applicationVisibilities>
        <application>Sales</application>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>Service</application>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>Marketing</application>
        <visible>false</visible>
    </applicationVisibilities>
</PermissionSet>`;

      const filePath = join(testDir, 'App_Visibility.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'App_Visibility');

      expect(result.applicationVisibilities).to.be.an('array').with.lengthOf(2);
      expect(result.applicationVisibilities).to.include.members(['Sales', 'Service']);
      expect(result.applicationVisibilities).to.not.include('Marketing');
      expect(result.dependencies.applications).to.deep.equal(['Sales', 'Service']);
    });

    it('should extract tab visibility settings (AC-8)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Tab Visibility</label>
    <tabSettings>
        <tab>Account</tab>
        <visibility>Visible</visibility>
    </tabSettings>
    <tabSettings>
        <tab>Opportunity</tab>
        <visibility>Visible</visibility>
    </tabSettings>
    <tabSettings>
        <tab>CustomTab__c</tab>
        <visibility>Available</visibility>
    </tabSettings>
</PermissionSet>`;

      const filePath = join(testDir, 'Tab_Visibility.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Tab_Visibility');

      expect(result.tabSettings).to.be.an('array').with.lengthOf(3);
      expect(result.tabSettings).to.include.members(['Account', 'Opportunity', 'CustomTab__c']);
      expect(result.dependencies.tabs).to.deep.equal(['Account', 'Opportunity', 'CustomTab__c']);
    });

    it('should extract all dependent metadata types (AC-9)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Complete Dependencies</label>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Industry</field>
        <readable>true</readable>
    </fieldPermissions>
    <classAccesses>
        <apexClass>AccountService</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <pageAccesses>
        <apexPage>AccountDashboard</apexPage>
        <enabled>true</enabled>
    </pageAccesses>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanApproveDiscounts</name>
    </customPermissions>
    <applicationVisibilities>
        <application>Sales</application>
        <visible>true</visible>
    </applicationVisibilities>
    <tabSettings>
        <tab>Account</tab>
        <visibility>Visible</visibility>
    </tabSettings>
    <customMetadataTypeAccesses>
        <enabled>true</enabled>
        <name>AppConfig__mdt</name>
    </customMetadataTypeAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>Lead_Assignment_Flow</flow>
    </flowAccesses>
    <externalDataSourceAccesses>
        <enabled>true</enabled>
        <externalDataSource>External_API</externalDataSource>
    </externalDataSourceAccesses>
    <customSettingAccesses>
        <enabled>true</enabled>
        <name>AppSettings__c</name>
    </customSettingAccesses>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewAllData</name>
    </userPermissions>
    <recordTypeVisibilities>
        <recordType>Account.Enterprise</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
</PermissionSet>`;

      const filePath = join(testDir, 'All_Dependencies.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'All_Dependencies');

      // Verify all dependencies are captured
      expect(result.dependencies.objects).to.deep.equal(['Account']);
      expect(result.dependencies.fields).to.deep.equal(['Account.Industry']);
      expect(result.dependencies.apexClasses).to.deep.equal(['AccountService']);
      expect(result.dependencies.visualforcePages).to.deep.equal(['AccountDashboard']);
      expect(result.dependencies.customPermissions).to.deep.equal(['CanApproveDiscounts']);
      expect(result.dependencies.applications).to.deep.equal(['Sales']);
      expect(result.dependencies.tabs).to.deep.equal(['Account']);
      expect(result.dependencies.customMetadataTypes).to.deep.equal(['AppConfig__mdt']);
      expect(result.dependencies.flows).to.deep.equal(['Lead_Assignment_Flow']);
      expect(result.dependencies.externalDataSources).to.deep.equal(['External_API']);
      expect(result.dependencies.customSettings).to.deep.equal(['AppSettings__c']);
      expect(result.dependencies.recordTypes).to.deep.equal(['Account.Enterprise']);
      expect(result.optionalDependencies).to.deep.equal({
        visualforcePages: ['AccountDashboard'],
        applications: ['Sales'],
        tabs: ['Account'],
      });

      // Verify user permissions are extracted
      expect(result.userPermissions).to.deep.equal(['ViewAllData']);
    });

    it('should handle permission set with single item (not array)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Single Item</label>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
</PermissionSet>`;

      const filePath = join(testDir, 'Single_Item.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Single_Item');

      expect(result.objectPermissions).to.be.an('array').with.lengthOf(1);
      expect(result.objectPermissions).to.include('Account');
    });

    it('should handle permission set with no permissions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Empty Permissions</label>
    <description>No permissions granted</description>
</PermissionSet>`;

      const filePath = join(testDir, 'Empty_Perms.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parsePermissionSet(filePath, 'Empty_Perms');

      expect(result.objectPermissions).to.be.an('array').with.lengthOf(0);
      expect(result.fieldPermissions).to.be.an('array').with.lengthOf(0);
      expect(result.apexClassAccesses).to.be.an('array').with.lengthOf(0);
      expect(result.visualforcePageAccesses).to.be.an('array').with.lengthOf(0);
      expect(result.customPermissions).to.be.an('array').with.lengthOf(0);
      expect(result.dependencies.objects).to.be.an('array').with.lengthOf(0);
    });

    it('should throw error for invalid XML', async () => {
      const xmlContent = '<InvalidXML>';
      const filePath = join(testDir, 'Invalid.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parsePermissionSet(filePath, 'Invalid');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
      }
    });

    it('should throw error for missing PermissionSet root element', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<SomeOtherRoot>
    <label>Invalid Structure</label>
</SomeOtherRoot>`;

      const filePath = join(testDir, 'Invalid_Structure.permissionset-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parsePermissionSet(filePath, 'Invalid_Structure');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
        expect((error as Error).message).to.match(/missing PermissionSet root element/);
      }
    });
  });
});
