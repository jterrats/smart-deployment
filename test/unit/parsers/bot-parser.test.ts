/**
 * Unit tests for Bot Parser
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseBot } from '../../../src/parsers/bot-parser.js';

describe('Bot Parser', () => {
  const testDir = join(process.cwd(), '.tmp-test-bot-parser');

  before(async () => {
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('parseBot', () => {
    it('should parse basic Bot metadata', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Customer support bot</description>
    <label>Support Bot</label>
    <botVersions>
        <botDialogs>
            <developerName>Greeting</developerName>
            <label>Greeting Dialog</label>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'Support_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Support_Bot');

      expect(result.name).to.equal('Support_Bot');
      expect(result.label).to.equal('Support Bot');
      expect(result.description).to.equal('Customer support bot');
    });

    /**
     * @ac US-024-AC-1: Extract dialog references
     */
    it('US-024-AC-1: should extract dialog references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Multi Dialog Bot</label>
    <botVersions>
        <botDialogs>
            <developerName>Greeting</developerName>
            <label>Greeting</label>
        </botDialogs>
        <botDialogs>
            <developerName>CaseCreation</developerName>
            <label>Create Case</label>
        </botDialogs>
        <botDialogs>
            <developerName>FAQ</developerName>
            <label>FAQ</label>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'Multi_Dialog.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Multi_Dialog');

      expect(result.dialogs).to.be.an('array').with.lengthOf(3);
      expect(result.dialogs).to.include.members(['Greeting', 'CaseCreation', 'FAQ']);
      expect(result.dependencies.dialogs).to.deep.equal(result.dialogs);
    });

    /**
     * @ac US-024-AC-2: Extract GenAI prompt references
     */
    it('US-024-AC-2: should extract GenAI prompt references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>AI Bot</label>
    <botVersions>
        <botDialogs>
            <developerName>AIDialog</developerName>
            <label>AI Dialog</label>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>SummarizeCase</invocationActionName>
                    <invocationActionType>prompt</invocationActionType>
                </botInvocation>
            </botSteps>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>GenerateResponse</invocationActionName>
                    <invocationActionType>prompt</invocationActionType>
                </botInvocation>
            </botSteps>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'AI_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'AI_Bot');

      expect(result.genAiPrompts).to.be.an('array').with.lengthOf(2);
      expect(result.genAiPrompts).to.include.members(['SummarizeCase', 'GenerateResponse']);
      expect(result.dependencies.genAiPrompts).to.deep.equal(result.genAiPrompts);
    });

    /**
     * @ac US-024-AC-3: Extract Flow references
     */
    it('US-024-AC-3: should extract Flow references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Flow Bot</label>
    <botVersions>
        <botDialogs>
            <developerName>FlowDialog</developerName>
            <label>Flow Dialog</label>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>Case_Assignment_Flow</invocationActionName>
                    <invocationActionType>flow</invocationActionType>
                </botInvocation>
            </botSteps>
            <botSteps>
                <type>VariableOperation</type>
                <botVariableOperation>
                    <type>Collect</type>
                    <botInvocation>
                        <invocationActionName>Lead_Qualification_Flow</invocationActionName>
                        <invocationActionType>flow</invocationActionType>
                    </botInvocation>
                    <targetVariableName>result</targetVariableName>
                </botVariableOperation>
            </botSteps>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'Flow_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Flow_Bot');

      expect(result.flows).to.be.an('array').with.lengthOf(2);
      expect(result.flows).to.include.members(['Case_Assignment_Flow', 'Lead_Qualification_Flow']);
      expect(result.dependencies.flows).to.deep.equal(result.flows);
    });

    /**
     * @ac US-024-AC-4: Extract Apex action references
     */
    it('US-024-AC-4: should extract Apex action references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Apex Bot</label>
    <botVersions>
        <botDialogs>
            <developerName>ApexDialog</developerName>
            <label>Apex Dialog</label>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>AccountService.getAccount</invocationActionName>
                    <invocationActionType>apex</invocationActionType>
                </botInvocation>
            </botSteps>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>CaseService.createCase</invocationActionName>
                    <invocationActionType>apex</invocationActionType>
                </botInvocation>
            </botSteps>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'Apex_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Apex_Bot');

      expect(result.apexActions).to.be.an('array').with.lengthOf(2);
      expect(result.apexActions).to.include.members([
        'AccountService.getAccount',
        'CaseService.createCase',
      ]);
      expect(result.dependencies.apexActions).to.deep.equal(result.apexActions);
    });

    /**
     * @ac US-024-AC-5: Extract menu item references
     */
    it('US-024-AC-5: should extract menu item references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Menu Bot</label>
    <botVersions>
        <botDialogs>
            <developerName>MainMenu</developerName>
            <label>Main Menu</label>
            <showInFooterMenu>true</showInFooterMenu>
        </botDialogs>
        <botDialogs>
            <developerName>HelpDialog</developerName>
            <label>Help</label>
            <showInFooterMenu>true</showInFooterMenu>
        </botDialogs>
        <botDialogs>
            <developerName>InternalDialog</developerName>
            <label>Internal</label>
            <showInFooterMenu>false</showInFooterMenu>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'Menu_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Menu_Bot');

      expect(result.menuItems).to.be.an('array').with.lengthOf(2);
      expect(result.menuItems).to.include.members(['MainMenu', 'HelpDialog']);
      expect(result.menuItems).to.not.include('InternalDialog');
      expect(result.dependencies.menuItems).to.deep.equal(result.menuItems);
    });

    /**
     * @ac US-024-AC-6: Link to all dependencies
     */
    it('US-024-AC-6: should link to all dependencies', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Complete Bot</label>
    <mlIntents>
        <developerName>CreateCase</developerName>
        <label>Create Case Intent</label>
    </mlIntents>
    <contextVariables>
        <dataType>SObject</dataType>
        <developerName>CurrentUser</developerName>
        <label>Current User</label>
        <SObjectType>User</SObjectType>
    </contextVariables>
    <botVersions>
        <conversationVariables>
            <dataType>SObject</dataType>
            <developerName>SelectedAccount</developerName>
            <label>Selected Account</label>
            <SObjectType>Account</SObjectType>
        </conversationVariables>
        <botDialogs>
            <developerName>CompleteDialog</developerName>
            <label>Complete Dialog</label>
            <showInFooterMenu>true</showInFooterMenu>
            <mlIntent>CreateCase</mlIntent>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>Case_Flow</invocationActionName>
                    <invocationActionType>flow</invocationActionType>
                </botInvocation>
            </botSteps>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>CaseService.create</invocationActionName>
                    <invocationActionType>apex</invocationActionType>
                </botInvocation>
            </botSteps>
            <botSteps>
                <type>Action</type>
                <botInvocation>
                    <invocationActionName>SummarizeIssue</invocationActionName>
                    <invocationActionType>prompt</invocationActionType>
                </botInvocation>
            </botSteps>
            <botSteps>
                <type>RecordLookup</type>
                <conversationRecordLookup>
                    <SObjectType>Case</SObjectType>
                    <targetVariableName>foundCase</targetVariableName>
                </conversationRecordLookup>
            </botSteps>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'Complete_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Complete_Bot');

      // Verify all dependencies are captured
      expect(result.dependencies.dialogs).to.include('CompleteDialog');
      expect(result.dependencies.genAiPrompts).to.include('SummarizeIssue');
      expect(result.dependencies.flows).to.include('Case_Flow');
      expect(result.dependencies.apexActions).to.include('CaseService.create');
      expect(result.dependencies.menuItems).to.include('CompleteDialog');
      expect(result.dependencies.mlIntents).to.include('CreateCase');
      expect(result.dependencies.sobjects).to.include.members(['User', 'Account', 'Case']);
    });

    it('should handle Bot with nested steps', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Nested Steps Bot</label>
    <botVersions>
        <botDialogs>
            <developerName>NestedDialog</developerName>
            <label>Nested Dialog</label>
            <botSteps>
                <type>Group</type>
                <botSteps>
                    <type>Action</type>
                    <botInvocation>
                        <invocationActionName>NestedFlow</invocationActionName>
                        <invocationActionType>flow</invocationActionType>
                    </botInvocation>
                </botSteps>
                <botSteps>
                    <type>Action</type>
                    <botInvocation>
                        <invocationActionName>NestedApex</invocationActionName>
                        <invocationActionType>apex</invocationActionType>
                    </botInvocation>
                </botSteps>
            </botSteps>
        </botDialogs>
    </botVersions>
</Bot>`;

      const filePath = join(testDir, 'Nested_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Nested_Bot');

      expect(result.flows).to.include('NestedFlow');
      expect(result.apexActions).to.include('NestedApex');
    });

    it('should handle Bot with no versions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Empty Bot</label>
</Bot>`;

      const filePath = join(testDir, 'Empty_Bot.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseBot(filePath, 'Empty_Bot');

      expect(result.dialogs).to.be.an('array').with.lengthOf(0);
      expect(result.flows).to.be.an('array').with.lengthOf(0);
      expect(result.genAiPrompts).to.be.an('array').with.lengthOf(0);
      expect(result.apexActions).to.be.an('array').with.lengthOf(0);
    });

    it('should throw error for invalid XML', async () => {
      const xmlContent = '<InvalidXML>';
      const filePath = join(testDir, 'Invalid.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseBot(filePath, 'Invalid');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
      }
    });

    it('should throw error for missing Bot root element', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<SomeOtherRoot>
    <label>Invalid</label>
</SomeOtherRoot>`;

      const filePath = join(testDir, 'Invalid_Structure.bot-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseBot(filePath, 'Invalid_Structure');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
        expect((error as Error).message).to.match(/missing Bot root element/);
      }
    });
  });
});

