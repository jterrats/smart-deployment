/**
 * Unit tests for Profile Parser
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseProfile } from '../../../src/parsers/profile-parser.js';

describe('Profile Parser', () => {
  const testDir = join(process.cwd(), '.tmp-test-profile-parser');

  before(async () => {
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('parseProfile', () => {
    it('should parse basic profile metadata', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
    <description>Sales users profile</description>
    <userLicense>Salesforce</userLicense>
</Profile>`;

      const filePath = join(testDir, 'Sales_User.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Sales_User');

      expect(result.name).to.equal('Sales_User');
      expect(result.custom).to.equal(true);
      expect(result.description).to.equal('Sales users profile');
      expect(result.userLicense).to.equal('Salesforce');
    });

    /**
     * @ac US-020-AC-1: Extract object permissions
     */
    it('US-020-AC-1: should extract object permissions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
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
</Profile>`;

      const filePath = join(testDir, 'Sales_Objects.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Sales_Objects');

      expect(result.objectPermissions).to.be.an('array').with.lengthOf(3);
      expect(result.objectPermissions).to.include.members(['Account', 'Contact', 'Opportunity']);
      expect(result.dependencies.objects).to.deep.equal(['Account', 'Contact', 'Opportunity']);
    });

    it('should ignore object permissions without any granted access', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
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
</Profile>`;

      const filePath = join(testDir, 'Object_Filtering.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Object_Filtering');

      expect(result.objectPermissions).to.deep.equal(['Contact']);
      expect(result.dependencies.objects).to.deep.equal(['Contact']);
    });

    /**
     * @ac US-020-AC-2: Extract field permissions
     */
    it('US-020-AC-2: should extract field-level security permissions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
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
</Profile>`;

      const filePath = join(testDir, 'Sales_FLS.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Sales_FLS');

      expect(result.fieldPermissions).to.be.an('array').with.lengthOf(3);
      expect(result.fieldPermissions).to.include.members(['Account.Industry', 'Account.Revenue', 'Opportunity.Amount']);
      expect(result.dependencies.fields).to.deep.equal(['Account.Industry', 'Account.Revenue', 'Opportunity.Amount']);
    });

    /**
     * @ac US-020-AC-3: Extract Apex class permissions
     */
    it('US-020-AC-3: should extract Apex class access permissions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
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
</Profile>`;

      const filePath = join(testDir, 'Apex_Access.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Apex_Access');

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

    it('should include only enabled profile access references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
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
        <application>VisibleApp</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>HiddenApp</application>
        <default>false</default>
        <visible>false</visible>
    </applicationVisibilities>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Contact</tab>
        <visibility>Hidden</visibility>
    </tabVisibilities>
</Profile>`;

      const filePath = join(testDir, 'Enabled_Only.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Enabled_Only');

      expect(result.apexClassAccesses).to.deep.equal(['EnabledClass']);
      expect(result.visualforcePageAccesses).to.deep.equal(['EnabledPage']);
      expect(result.applicationVisibilities).to.deep.equal(['VisibleApp']);
      expect(result.tabVisibilities).to.deep.equal(['standard-Account']);
      expect(result.optionalDependencies).to.deep.equal({
        layouts: [],
        visualforcePages: ['EnabledPage'],
        applications: ['VisibleApp'],
        tabs: ['standard-Account'],
      });
    });

    /**
     * @ac US-020-AC-4: Extract page layout assignments
     */
    it('US-020-AC-4: should extract page layout assignments', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Contact-Contact Layout</layout>
        <recordType>Contact.Enterprise</recordType>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Opportunity-Opportunity Layout</layout>
    </layoutAssignments>
</Profile>`;

      const filePath = join(testDir, 'Layout_Assignments.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Layout_Assignments');

      expect(result.layoutAssignments).to.be.an('array').with.lengthOf(3);
      expect(result.layoutAssignments).to.include.members([
        'Account-Account Layout',
        'Contact-Contact Layout',
        'Opportunity-Opportunity Layout',
      ]);
      expect(result.dependencies.layouts).to.deep.equal([
        'Account-Account Layout',
        'Contact-Contact Layout',
        'Opportunity-Opportunity Layout',
      ]);
    });

    /**
     * @ac US-020-AC-5: Extract record type visibility
     */
    it('US-020-AC-5: should extract record type visibility', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Enterprise</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <recordTypeVisibilities>
        <default>false</default>
        <recordType>Account.SMB</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <recordTypeVisibilities>
        <default>false</default>
        <recordType>Opportunity.NewBusiness</recordType>
        <visible>false</visible>
    </recordTypeVisibilities>
</Profile>`;

      const filePath = join(testDir, 'Record_Types.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Record_Types');

      // Only visible record types should be extracted
      expect(result.recordTypeVisibilities).to.be.an('array').with.lengthOf(2);
      expect(result.recordTypeVisibilities).to.include.members(['Account.Enterprise', 'Account.SMB']);
      expect(result.recordTypeVisibilities).to.not.include('Opportunity.NewBusiness');
      expect(result.dependencies.recordTypes).to.deep.equal(['Account.Enterprise', 'Account.SMB']);
    });

    /**
     * @ac US-020-AC-6: Extract application assignments
     */
    it('US-020-AC-6: should extract application assignments', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
    <applicationVisibilities>
        <application>Sales</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>Service</application>
        <default>false</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>Marketing</application>
        <default>false</default>
        <visible>false</visible>
    </applicationVisibilities>
</Profile>`;

      const filePath = join(testDir, 'App_Visibility.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'App_Visibility');

      expect(result.applicationVisibilities).to.be.an('array').with.lengthOf(2);
      expect(result.applicationVisibilities).to.include.members(['Sales', 'Service']);
      expect(result.applicationVisibilities).to.not.include('Marketing');
      expect(result.dependencies.applications).to.deep.equal(['Sales', 'Service']);
    });

    /**
     * @ac US-020-AC-7: Link to dependent metadata
     */
    it('US-020-AC-7: should link to all dependent metadata', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
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
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
    </layoutAssignments>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Enterprise</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <applicationVisibilities>
        <application>Sales</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <tabVisibilities>
        <tab>Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanApproveDiscounts</name>
    </customPermissions>
    <customMetadataTypeAccesses>
        <enabled>true</enabled>
        <name>AppConfig__mdt</name>
    </customMetadataTypeAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>Lead_Assignment_Flow</flow>
    </flowAccesses>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewAllData</name>
    </userPermissions>
</Profile>`;

      const filePath = join(testDir, 'All_Dependencies.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'All_Dependencies');

      // Verify all dependencies are captured
      expect(result.dependencies.objects).to.deep.equal(['Account']);
      expect(result.dependencies.fields).to.deep.equal(['Account.Industry']);
      expect(result.dependencies.apexClasses).to.deep.equal(['AccountService']);
      expect(result.dependencies.visualforcePages).to.deep.equal(['AccountDashboard']);
      expect(result.dependencies.layouts).to.deep.equal(['Account-Account Layout']);
      expect(result.dependencies.recordTypes).to.deep.equal(['Account.Enterprise']);
      expect(result.dependencies.applications).to.deep.equal(['Sales']);
      expect(result.dependencies.tabs).to.deep.equal(['Account']);
      expect(result.dependencies.customPermissions).to.deep.equal(['CanApproveDiscounts']);
      expect(result.dependencies.customMetadataTypes).to.deep.equal(['AppConfig__mdt']);
      expect(result.dependencies.flows).to.deep.equal(['Lead_Assignment_Flow']);
      expect(result.optionalDependencies).to.deep.equal({
        layouts: ['Account-Account Layout'],
        visualforcePages: ['AccountDashboard'],
        applications: ['Sales'],
        tabs: ['Account'],
      });

      // Verify user permissions are extracted
      expect(result.userPermissions).to.deep.equal(['ViewAllData']);
    });

    it('should extract custom setting and external data source accesses', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <externalDataSourceAccesses>
        <enabled>true</enabled>
        <externalDataSource>ERP_Connection</externalDataSource>
    </externalDataSourceAccesses>
    <externalDataSourceAccesses>
        <enabled>false</enabled>
        <externalDataSource>Disabled_ERP</externalDataSource>
    </externalDataSourceAccesses>
    <customSettingAccesses>
        <enabled>true</enabled>
        <name>AppSettings__c</name>
    </customSettingAccesses>
    <customSettingAccesses>
        <enabled>false</enabled>
        <name>DisabledSettings__c</name>
    </customSettingAccesses>
</Profile>`;

      const filePath = join(testDir, 'Extended_Access.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Extended_Access');

      expect(result.externalDataSourceAccesses).to.deep.equal(['ERP_Connection']);
      expect(result.customSettingAccesses).to.deep.equal(['AppSettings__c']);
      expect(result.dependencies.externalDataSources).to.deep.equal(['ERP_Connection']);
      expect(result.dependencies.customSettings).to.deep.equal(['AppSettings__c']);
    });

    it('should handle profile with single item (not array)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>false</custom>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
</Profile>`;

      const filePath = join(testDir, 'Single_Item.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Single_Item');

      expect(result.objectPermissions).to.be.an('array').with.lengthOf(1);
      expect(result.objectPermissions).to.include('Account');
    });

    it('should handle profile with no permissions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <custom>true</custom>
    <description>No permissions granted</description>
</Profile>`;

      const filePath = join(testDir, 'Empty_Perms.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Empty_Perms');

      expect(result.objectPermissions).to.be.an('array').with.lengthOf(0);
      expect(result.fieldPermissions).to.be.an('array').with.lengthOf(0);
      expect(result.apexClassAccesses).to.be.an('array').with.lengthOf(0);
      expect(result.visualforcePageAccesses).to.be.an('array').with.lengthOf(0);
      expect(result.layoutAssignments).to.be.an('array').with.lengthOf(0);
      expect(result.dependencies.objects).to.be.an('array').with.lengthOf(0);
    });

    it('should throw error for invalid XML', async () => {
      const xmlContent = '<InvalidXML>';
      const filePath = join(testDir, 'Invalid.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseProfile(filePath, 'Invalid');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
      }
    });

    it('should throw error for missing Profile root element', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<SomeOtherRoot>
    <custom>true</custom>
</SomeOtherRoot>`;

      const filePath = join(testDir, 'Invalid_Structure.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseProfile(filePath, 'Invalid_Structure');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
        expect((error as Error).message).to.match(/missing Profile root element/);
      }
    });

    it('should default custom to false when not specified', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userLicense>Salesforce</userLicense>
</Profile>`;

      const filePath = join(testDir, 'Standard.profile-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseProfile(filePath, 'Standard');

      expect(result.custom).to.equal(false);
    });
  });
});
