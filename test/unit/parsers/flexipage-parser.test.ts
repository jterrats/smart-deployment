/**
 * Unit tests for FlexiPage Parser
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseFlexiPage } from '../../../src/parsers/flexipage-parser.js';

describe('FlexiPage Parser', () => {
  const testDir = join(process.cwd(), '.tmp-test-flexipage-parser');

  before(async () => {
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('parseFlexiPage', () => {
    it('should parse basic FlexiPage metadata', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Account record page</description>
    <masterLabel>Account Record Page</masterLabel>
    <sobjectType>Account</sobjectType>
    <type>RecordPage</type>
    <template>
        <name>flexipage:recordHomeTemplateDesktop</name>
    </template>
</FlexiPage>`;

      const filePath = join(testDir, 'Account_Record_Page.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'Account_Record_Page');

      expect(result.name).to.equal('Account_Record_Page');
      expect(result.masterLabel).to.equal('Account Record Page');
      expect(result.type).to.equal('RecordPage');
      expect(result.sobjectType).to.equal('Account');
    });

    /**
     * @ac US-022-AC-1: Extract LWC component references
     */
    it('US-022-AC-1: should extract LWC component references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>LWC Components Page</masterLabel>
    <type>RecordPage</type>
    <flexiPageRegions>
        <name>main</name>
        <type>Region</type>
        <itemInstances>
            <componentInstance>
                <componentName>c:accountSummary</componentName>
            </componentInstance>
        </itemInstances>
        <itemInstances>
            <componentInstance>
                <componentName>c:relatedContacts</componentName>
            </componentInstance>
        </itemInstances>
    </flexiPageRegions>
</FlexiPage>`;

      const filePath = join(testDir, 'LWC_Components.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'LWC_Components');

      expect(result.lwcComponents).to.be.an('array').with.lengthOf(2);
      expect(result.lwcComponents).to.include.members(['c:accountSummary', 'c:relatedContacts']);
      expect(result.dependencies.lwcComponents).to.deep.equal(result.lwcComponents);
    });

    /**
     * @ac US-022-AC-2: Extract Aura component references
     */
    it('US-022-AC-2: should extract Aura component references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Aura Components Page</masterLabel>
    <type>RecordPage</type>
    <flexiPageRegions>
        <name>sidebar</name>
        <type>Region</type>
        <itemInstances>
            <componentInstance>
                <componentName>c:AccountChart</componentName>
            </componentInstance>
        </itemInstances>
        <itemInstances>
            <componentInstance>
                <componentName>c:OpportunityList</componentName>
            </componentInstance>
        </itemInstances>
    </flexiPageRegions>
</FlexiPage>`;

      const filePath = join(testDir, 'Aura_Components.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'Aura_Components');

      expect(result.auraComponents).to.be.an('array').with.lengthOf(2);
      expect(result.auraComponents).to.include.members(['c:AccountChart', 'c:OpportunityList']);
      expect(result.dependencies.auraComponents).to.deep.equal(result.auraComponents);
    });

    /**
     * @ac US-022-AC-3: Extract object references
     */
    it('US-022-AC-3: should extract object references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Opportunity Page</masterLabel>
    <sobjectType>Opportunity</sobjectType>
    <type>RecordPage</type>
</FlexiPage>`;

      const filePath = join(testDir, 'Opportunity_Page.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'Opportunity_Page');

      expect(result.objects).to.be.an('array').with.lengthOf(1);
      expect(result.objects).to.include('Opportunity');
      expect(result.dependencies.objects).to.deep.equal(['Opportunity']);
    });

    /**
     * @ac US-022-AC-4: Extract record type filters
     */
    it('US-022-AC-4: should extract record type filters from visibility rules', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Conditional Components</masterLabel>
    <type>RecordPage</type>
    <sobjectType>Account</sobjectType>
    <flexiPageRegions>
        <name>main</name>
        <type>Region</type>
        <itemInstances>
            <componentInstance>
                <componentName>c:enterpriseView</componentName>
                <visibilityRule>
                    <criteria>
                        <leftValue>{!Record.RecordType.DeveloperName}</leftValue>
                        <operator>EQUAL</operator>
                        <rightValue>Enterprise</rightValue>
                    </criteria>
                </visibilityRule>
            </componentInstance>
        </itemInstances>
        <itemInstances>
            <componentInstance>
                <componentName>c:smbView</componentName>
                <visibilityRule>
                    <criteria>
                        <leftValue>{!Record.RecordType.DeveloperName}</leftValue>
                        <operator>EQUAL</operator>
                        <rightValue>SMB</rightValue>
                    </criteria>
                </visibilityRule>
            </componentInstance>
        </itemInstances>
    </flexiPageRegions>
</FlexiPage>`;

      const filePath = join(testDir, 'RT_Filters.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'RT_Filters');

      expect(result.recordTypeFilters).to.be.an('array').with.lengthOf(2);
      expect(result.recordTypeFilters).to.include.members(['Enterprise', 'SMB']);
      expect(result.dependencies.recordTypes).to.deep.equal(result.recordTypeFilters);
    });

    /**
     * @ac US-022-AC-5: Extract region configurations
     */
    it('US-022-AC-5: should extract region configurations', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Multi Region Page</masterLabel>
    <type>RecordPage</type>
    <flexiPageRegions>
        <name>header</name>
        <type>Region</type>
    </flexiPageRegions>
    <flexiPageRegions>
        <name>main</name>
        <type>Region</type>
    </flexiPageRegions>
    <flexiPageRegions>
        <name>sidebar</name>
        <type>Region</type>
    </flexiPageRegions>
    <flexiPageRegions>
        <name>footer</name>
        <type>Region</type>
    </flexiPageRegions>
</FlexiPage>`;

      const filePath = join(testDir, 'Multi_Region.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'Multi_Region');

      expect(result.regions).to.be.an('array').with.lengthOf(4);
      expect(result.regions).to.include.members(['header', 'main', 'sidebar', 'footer']);
      expect(result.dependencies.regions).to.deep.equal(result.regions);
    });

    /**
     * @ac US-022-AC-6: Link to all component dependencies
     */
    it('US-022-AC-6: should link to all component dependencies', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Complete Dependencies</masterLabel>
    <sobjectType>Account</sobjectType>
    <type>RecordPage</type>
    <flexiPageRegions>
        <name>main</name>
        <type>Region</type>
        <itemInstances>
            <componentInstance>
                <componentName>c:lwcComponent</componentName>
            </componentInstance>
        </itemInstances>
        <itemInstances>
            <componentInstance>
                <componentName>c:AuraComponent</componentName>
            </componentInstance>
        </itemInstances>
        <itemInstances>
            <componentInstance>
                <componentName>c:conditionalComponent</componentName>
                <visibilityRule>
                    <criteria>
                        <leftValue>{!Record.RecordType.DeveloperName}</leftValue>
                        <operator>EQUAL</operator>
                        <rightValue>Enterprise</rightValue>
                    </criteria>
                </visibilityRule>
            </componentInstance>
        </itemInstances>
    </flexiPageRegions>
    <quickActionList>
        <quickActionListItems>
            <quickActionName>SendEmail</quickActionName>
        </quickActionListItems>
    </quickActionList>
</FlexiPage>`;

      const filePath = join(testDir, 'All_Dependencies.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'All_Dependencies');

      // Verify all dependencies are captured
      expect(result.dependencies.lwcComponents).to.include('c:lwcComponent');
      expect(result.dependencies.lwcComponents).to.include('c:conditionalComponent');
      expect(result.dependencies.auraComponents).to.include('c:AuraComponent');
      expect(result.dependencies.objects).to.include('Account');
      expect(result.dependencies.recordTypes).to.include('Enterprise');
      expect(result.dependencies.regions).to.include('main');
      expect(result.dependencies.quickActions).to.include('SendEmail');
    });

    it('should handle FlexiPage with single region', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Single Region</masterLabel>
    <type>AppPage</type>
    <flexiPageRegions>
        <name>content</name>
        <type>Region</type>
        <itemInstances>
            <componentInstance>
                <componentName>c:myComponent</componentName>
            </componentInstance>
        </itemInstances>
    </flexiPageRegions>
</FlexiPage>`;

      const filePath = join(testDir, 'Single_Region.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'Single_Region');

      expect(result.regions).to.be.an('array').with.lengthOf(1);
      expect(result.regions).to.include('content');
    });

    it('should handle FlexiPage with no components', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Empty Page</masterLabel>
    <type>AppPage</type>
</FlexiPage>`;

      const filePath = join(testDir, 'Empty_Page.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseFlexiPage(filePath, 'Empty_Page');

      expect(result.lwcComponents).to.be.an('array').with.lengthOf(0);
      expect(result.auraComponents).to.be.an('array').with.lengthOf(0);
      expect(result.regions).to.be.an('array').with.lengthOf(0);
    });

    it('should throw error for invalid XML', async () => {
      const xmlContent = '<InvalidXML>';
      const filePath = join(testDir, 'Invalid.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseFlexiPage(filePath, 'Invalid');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
      }
    });

    it('should throw error for missing FlexiPage root element', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<SomeOtherRoot>
    <masterLabel>Invalid</masterLabel>
</SomeOtherRoot>`;

      const filePath = join(testDir, 'Invalid_Structure.flexipage-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseFlexiPage(filePath, 'Invalid_Structure');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
        expect((error as Error).message).to.match(/missing FlexiPage root element/);
      }
    });
  });
});

