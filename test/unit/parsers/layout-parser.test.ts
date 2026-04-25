/**
 * Unit tests for Layout Parser
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseLayout } from '../../../src/parsers/layout-parser.js';

describe('Layout Parser', () => {
  const testDir = join(process.cwd(), '.tmp-test-layout-parser');

  before(async () => {
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('parseLayout', () => {
    /**
     * @ac US-021-AC-1: Extract related object
     */
    it('US-021-AC-1: should extract related object from layout name', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <layoutSections>
        <customLabel>false</customLabel>
        <detailHeading>true</detailHeading>
        <editHeading>true</editHeading>
        <label>Information</label>
        <layoutColumns>
            <layoutItems>
                <field>Name</field>
            </layoutItems>
        </layoutColumns>
        <style>TwoColumnsTopToBottom</style>
    </layoutSections>
</Layout>`;

      const filePath = join(testDir, 'Account-Account Layout.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Account Layout');

      expect(result.object).to.equal('Account');
      expect(result.name).to.equal('Account-Account Layout');
      expect(result.dependencies.object).to.equal('Account');
    });

    /**
     * @ac US-021-AC-1: Extract related object
     */
    it('US-021-AC-1: should extract custom object from layout name', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
</Layout>`;

      const filePath = join(testDir, 'CustomObject__c-Custom Layout.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'CustomObject__c-Custom Layout');

      expect(result.object).to.equal('CustomObject__c');
    });

    /**
     * @ac US-021-AC-2: Extract custom button references
     */
    it('US-021-AC-2: should extract custom button references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <customButtons>New_Custom_Button</customButtons>
    <customButtons>Edit_Button</customButtons>
    <customButtons>Delete_Button</customButtons>
</Layout>`;

      const filePath = join(testDir, 'Account-With Buttons.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-With Buttons');

      expect(result.customButtons).to.be.an('array').with.lengthOf(3);
      expect(result.customButtons).to.include.members(['New_Custom_Button', 'Edit_Button', 'Delete_Button']);
      expect(result.dependencies.customButtons).to.deep.equal(result.customButtons);
      expect(result.optionalDependencies.customButtons).to.deep.equal(result.customButtons);
    });

    /**
     * @ac US-021-AC-2: Extract custom button references
     */
    it('US-021-AC-2: should extract custom buttons from related lists', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <relatedLists>
        <customButtons>New_Related</customButtons>
        <relatedList>Opportunities</relatedList>
    </relatedLists>
</Layout>`;

      const filePath = join(testDir, 'Account-Related Buttons.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Related Buttons');

      expect(result.customButtons).to.include('New_Related');
    });

    /**
     * @ac US-021-AC-3: Extract Visualforce page references
     */
    it('US-021-AC-3: should extract Visualforce page references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <layoutSections>
        <layoutColumns>
            <layoutItems>
                <page>AccountDashboard</page>
            </layoutItems>
            <layoutItems>
                <page>AccountDetails</page>
            </layoutItems>
        </layoutColumns>
        <style>OneColumn</style>
    </layoutSections>
</Layout>`;

      const filePath = join(testDir, 'Account-VF Pages.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-VF Pages');

      expect(result.visualforcePages).to.be.an('array').with.lengthOf(2);
      expect(result.visualforcePages).to.include.members(['AccountDashboard', 'AccountDetails']);
      expect(result.dependencies.visualforcePages).to.deep.equal(result.visualforcePages);
    });

    /**
     * @ac US-021-AC-3: Extract Visualforce page references
     */
    it('US-021-AC-3: should extract Visualforce pages from feed layout', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <feedLayout>
        <leftComponents>
            <componentType>Visualforce</componentType>
            <page>LeftSidebar</page>
        </leftComponents>
        <rightComponents>
            <componentType>Visualforce</componentType>
            <page>RightPanel</page>
        </rightComponents>
    </feedLayout>
</Layout>`;

      const filePath = join(testDir, 'Account-Feed VF.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Feed VF');

      expect(result.visualforcePages).to.include.members(['LeftSidebar', 'RightPanel']);
    });

    it('should extract Visualforce pages and canvas apps from related content and feed layout', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <feedLayout>
        <rightComponents>
            <componentType>Canvas</componentType>
            <page>FeedCanvasApp</page>
        </rightComponents>
    </feedLayout>
    <relatedContent>
        <relatedContentItems>
            <layoutItem>
                <page>EmbeddedVF</page>
                <canvas>EmbeddedCanvas</canvas>
            </layoutItem>
        </relatedContentItems>
    </relatedContent>
</Layout>`;

      const filePath = join(testDir, 'Account-Rich Content.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Rich Content');

      expect(result.visualforcePages).to.include('EmbeddedVF');
      expect(result.canvasApps).to.include.members(['FeedCanvasApp', 'EmbeddedCanvas']);
      expect(result.optionalDependencies.visualforcePages).to.include('EmbeddedVF');
      expect(result.optionalDependencies.canvasApps).to.include.members(['FeedCanvasApp', 'EmbeddedCanvas']);
    });

    /**
     * @ac US-021-AC-4: Extract field references
     */
    it('US-021-AC-4: should extract field references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <layoutSections>
        <layoutColumns>
            <layoutItems>
                <field>Name</field>
            </layoutItems>
            <layoutItems>
                <field>Industry</field>
            </layoutItems>
        </layoutColumns>
        <layoutColumns>
            <layoutItems>
                <field>Phone</field>
            </layoutItems>
            <layoutItems>
                <field>Website</field>
            </layoutItems>
        </layoutColumns>
        <style>TwoColumnsLeftToRight</style>
    </layoutSections>
</Layout>`;

      const filePath = join(testDir, 'Account-Fields.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Fields');

      expect(result.fields).to.be.an('array').with.lengthOf(4);
      expect(result.fields).to.include.members(['Name', 'Industry', 'Phone', 'Website']);
      expect(result.dependencies.fields).to.deep.equal(result.fields);
    });

    /**
     * @ac US-021-AC-4: Extract field references
     */
    it('US-021-AC-4: should extract fields from mini layout', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <miniLayout>
        <fields>Id</fields>
        <fields>Name</fields>
        <fields>Owner</fields>
    </miniLayout>
</Layout>`;

      const filePath = join(testDir, 'Account-Mini.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Mini');

      expect(result.fields).to.include.members(['Id', 'Name', 'Owner']);
    });

    it('should extract fields from multiline layout and related content', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <multilineLayoutFields>Description</multilineLayoutFields>
    <relatedContent>
        <relatedContentItems>
            <layoutItem>
                <field>OwnerId</field>
            </layoutItem>
        </relatedContentItems>
    </relatedContent>
</Layout>`;

      const filePath = join(testDir, 'Account-Extra Fields.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Extra Fields');

      expect(result.fields).to.include.members(['Description', 'OwnerId']);
    });

    /**
     * @ac US-021-AC-5: Extract related list references
     */
    it('US-021-AC-5: should extract related list references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <relatedLists>
        <relatedList>Opportunities</relatedList>
    </relatedLists>
    <relatedLists>
        <relatedList>Contacts</relatedList>
    </relatedLists>
    <relatedLists>
        <relatedList>Cases</relatedList>
    </relatedLists>
</Layout>`;

      const filePath = join(testDir, 'Account-Related Lists.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Related Lists');

      expect(result.relatedLists).to.be.an('array').with.lengthOf(3);
      expect(result.relatedLists).to.include.members(['Opportunities', 'Contacts', 'Cases']);
      expect(result.dependencies.relatedLists).to.deep.equal(result.relatedLists);
    });

    /**
     * @ac US-021-AC-5: Extract related list references
     */
    it('US-021-AC-5: should extract fields from related lists', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <relatedLists>
        <fields>NAME</fields>
        <fields>STAGE_NAME</fields>
        <fields>AMOUNT</fields>
        <relatedList>Opportunities</relatedList>
    </relatedLists>
</Layout>`;

      const filePath = join(testDir, 'Account-Related List Fields.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Related List Fields');

      expect(result.fields).to.include.members(['NAME', 'STAGE_NAME', 'AMOUNT']);
    });

    /**
     * @ac US-021-AC-6: Link to dependent metadata
     */
    it('US-021-AC-6: should link to all dependent metadata', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <customButtons>Custom_Button</customButtons>
    <layoutSections>
        <layoutColumns>
            <layoutItems>
                <field>Name</field>
            </layoutItems>
            <layoutItems>
                <page>VFPage</page>
            </layoutItems>
            <layoutItems>
                <canvas>CanvasApp</canvas>
            </layoutItems>
            <layoutItems>
                <customLink>CustomLink1</customLink>
            </layoutItems>
        </layoutColumns>
        <style>OneColumn</style>
    </layoutSections>
    <relatedLists>
        <relatedList>Opportunities</relatedList>
    </relatedLists>
    <quickActionList>
        <quickActionListItems>
            <quickActionName>SendEmail</quickActionName>
        </quickActionListItems>
    </quickActionList>
</Layout>`;

      const filePath = join(testDir, 'Account-All Dependencies.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-All Dependencies');

      // Verify all dependencies are captured
      expect(result.dependencies.object).to.equal('Account');
      expect(result.dependencies.customButtons).to.include('Custom_Button');
      expect(result.dependencies.visualforcePages).to.include('VFPage');
      expect(result.dependencies.fields).to.include('Name');
      expect(result.dependencies.relatedLists).to.include('Opportunities');
      expect(result.dependencies.quickActions).to.include('SendEmail');
      expect(result.dependencies.canvasApps).to.include('CanvasApp');
      expect(result.dependencies.customLinks).to.include('CustomLink1');
      expect(result.optionalDependencies.quickActions).to.include('SendEmail');
      expect(result.optionalDependencies.customLinks).to.include('CustomLink1');
    });

    /**
     * @ac US-021-AC-6: Link to dependent metadata
     */
    it('US-021-AC-6: should handle layout with quick actions from platformActionList', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <platformActionList>
        <actionListContext>Record</actionListContext>
        <platformActionListItems>
            <actionName>Action1</actionName>
            <actionType>QuickAction</actionType>
            <sortOrder>1</sortOrder>
        </platformActionListItems>
        <platformActionListItems>
            <actionName>Action2</actionName>
            <actionType>QuickAction</actionType>
            <sortOrder>2</sortOrder>
        </platformActionListItems>
    </platformActionList>
</Layout>`;

      const filePath = join(testDir, 'Account-Platform Actions.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Platform Actions');

      expect(result.quickActions).to.include.members(['Action1', 'Action2']);
    });

    it('should extract custom buttons and action links from platform actions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <platformActionList>
        <actionListContext>Record</actionListContext>
        <platformActionListItems>
            <actionName>CustomMassUpdate</actionName>
            <actionType>CustomButton</actionType>
            <sortOrder>1</sortOrder>
        </platformActionListItems>
        <platformActionListItems>
            <actionName>RelatedKnowledge</actionName>
            <actionType>ActionLink</actionType>
            <sortOrder>2</sortOrder>
        </platformActionListItems>
    </platformActionList>
    <relatedObjects>Contact</relatedObjects>
    <relatedObjects>Case</relatedObjects>
</Layout>`;

      const filePath = join(testDir, 'Account-Platform Dependencies.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Platform Dependencies');

      expect(result.customButtons).to.include('CustomMassUpdate');
      expect(result.customLinks).to.include('RelatedKnowledge');
      expect(result.relatedObjects).to.deep.equal(['Contact', 'Case']);
      expect(result.dependencies.relatedObjects).to.deep.equal(['Contact', 'Case']);
    });

    it('should handle layout with single item (not array)', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
    <customButtons>SingleButton</customButtons>
    <layoutSections>
        <layoutColumns>
            <layoutItems>
                <field>Name</field>
            </layoutItems>
        </layoutColumns>
        <style>OneColumn</style>
    </layoutSections>
</Layout>`;

      const filePath = join(testDir, 'Account-Single Items.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Single Items');

      expect(result.customButtons).to.be.an('array').with.lengthOf(1);
      expect(result.customButtons).to.include('SingleButton');
      expect(result.fields).to.be.an('array').with.lengthOf(1);
      expect(result.fields).to.include('Name');
    });

    it('should handle empty layout', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
</Layout>`;

      const filePath = join(testDir, 'Account-Empty.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseLayout(filePath, 'Account-Empty');

      expect(result.customButtons).to.be.an('array').with.lengthOf(0);
      expect(result.visualforcePages).to.be.an('array').with.lengthOf(0);
      expect(result.fields).to.be.an('array').with.lengthOf(0);
      expect(result.relatedLists).to.be.an('array').with.lengthOf(0);
      expect(result.quickActions).to.be.an('array').with.lengthOf(0);
    });

    it('should throw error for invalid XML', async () => {
      const xmlContent = '<InvalidXML>';
      const filePath = join(testDir, 'Invalid.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseLayout(filePath, 'Invalid');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
      }
    });

    it('should throw error for missing Layout root element', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<SomeOtherRoot>
    <label>Invalid Structure</label>
</SomeOtherRoot>`;

      const filePath = join(testDir, 'Invalid_Structure.layout-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseLayout(filePath, 'Invalid_Structure');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
        expect((error as Error).message).to.match(/missing Layout root element/);
      }
    });
  });
});
