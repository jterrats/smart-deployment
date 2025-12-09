/**
 * Unit tests for GenAI Prompt Template Parser
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseGenAiPrompt } from '../../../src/parsers/genai-prompt-parser.js';

describe('GenAI Prompt Template Parser', () => {
  const testDir = join(process.cwd(), '.tmp-test-genai-prompt-parser');

  before(async () => {
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('parseGenAiPrompt', () => {
    it('should parse basic GenAI Prompt Template metadata', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Summarize case details</description>
    <developerName>CaseSummary</developerName>
    <masterLabel>Case Summary</masterLabel>
    <status>Published</status>
    <type>einstein_gpt__flex</type>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'CaseSummary.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'CaseSummary');

      expect(result.name).to.equal('CaseSummary');
      expect(result.developerName).to.equal('CaseSummary');
      expect(result.masterLabel).to.equal('Case Summary');
      expect(result.description).to.equal('Summarize case details');
      expect(result.status).to.equal('Published');
      expect(result.type).to.equal('einstein_gpt__flex');
    });

    /**
     * @ac US-025-AC-1: Extract related object references
     */
    it('US-025-AC-1: should extract related object references', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <developerName>CasePrompt</developerName>
    <masterLabel>Case Prompt</masterLabel>
    <relatedEntity>Case</relatedEntity>
    <relatedField>Subject</relatedField>
    <templateVersions>
        <templateDataProviders>
            <apiName>CaseProvider</apiName>
            <dataProviderType>SObject</dataProviderType>
            <object>Case</object>
            <fields>
                <apiName>Subject</apiName>
            </fields>
            <fields>
                <apiName>Description</apiName>
            </fields>
        </templateDataProviders>
        <templateDataProviders>
            <apiName>ContactProvider</apiName>
            <object>Contact</object>
            <fields>
                <apiName>Name</apiName>
            </fields>
        </templateDataProviders>
    </templateVersions>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'Case_Prompt.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'Case_Prompt');

      expect(result.relatedEntity).to.equal('Case');
      expect(result.sobjects).to.be.an('array').with.lengthOf(2);
      expect(result.sobjects).to.include.members(['Case', 'Contact']);
      expect(result.dependencies.sobjects).to.deep.equal(result.sobjects);
    });

    /**
     * @ac US-025-AC-2: Extract field references in prompts
     */
    it('US-025-AC-2: should extract field references from data providers', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <developerName>AccountPrompt</developerName>
    <masterLabel>Account Prompt</masterLabel>
    <relatedEntity>Account</relatedEntity>
    <relatedField>Name</relatedField>
    <templateVersions>
        <templateDataProviders>
            <apiName>AccountProvider</apiName>
            <object>Account</object>
            <fields>
                <apiName>Name</apiName>
            </fields>
            <fields>
                <apiName>Industry</apiName>
            </fields>
            <fields>
                <apiName>AnnualRevenue</apiName>
            </fields>
        </templateDataProviders>
    </templateVersions>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'Account_Fields.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'Account_Fields');

      expect(result.fields).to.be.an('array');
      expect(result.fields).to.include.members([
        'Account.Name',
        'Account.Industry',
        'Account.AnnualRevenue',
      ]);
      expect(result.dependencies.fields).to.deep.equal(result.fields);
    });

    /**
     * @ac US-025-AC-2: Extract field references from prompt content
     */
    it('US-025-AC-2: should extract field references from prompt content', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <developerName>ContentPrompt</developerName>
    <masterLabel>Content Prompt</masterLabel>
    <templateVersions>
        <content>Summarize the case: {!Case.Subject} - {!Case.Description}. Contact: {!Contact.Name}</content>
        <number>1</number>
    </templateVersions>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'Content_Fields.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'Content_Fields');

      expect(result.fields).to.be.an('array').with.lengthOf(3);
      expect(result.fields).to.include.members(['Case.Subject', 'Case.Description', 'Contact.Name']);
    });

    /**
     * @ac US-025-AC-3: Extract model configurations
     */
    it('US-025-AC-3: should extract model configurations', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <developerName>MultiModelPrompt</developerName>
    <masterLabel>Multi Model Prompt</masterLabel>
    <templateVersions>
        <number>1</number>
        <primaryModel>sfdc_ai__DefaultGPT35Turbo</primaryModel>
    </templateVersions>
    <templateVersions>
        <number>2</number>
        <primaryModel>sfdc_ai__DefaultGPT4</primaryModel>
    </templateVersions>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'Multi_Model.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'Multi_Model');

      expect(result.models).to.be.an('array').with.lengthOf(2);
      expect(result.models).to.include.members(['sfdc_ai__DefaultGPT35Turbo', 'sfdc_ai__DefaultGPT4']);
      expect(result.dependencies.models).to.deep.equal(result.models);
    });

    /**
     * @ac US-025-AC-4: Detect circular dependencies with Flows
     * Note: This is a parser capability - we extract references that can be used
     * by dependency analysis to detect circular dependencies
     */
    it('US-025-AC-4: should parse metadata enabling circular dependency detection', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <developerName>FlowPrompt</developerName>
    <masterLabel>Flow Prompt</masterLabel>
    <relatedEntity>Case</relatedEntity>
    <templateVersions>
        <content>Process case {!Case.CaseNumber}</content>
        <templateVersionVariables>
            <developerName>flowResult</developerName>
            <type>Text</type>
        </templateVersionVariables>
    </templateVersions>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'Flow_Prompt.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'Flow_Prompt');

      // Parser provides data for dependency analysis
      expect(result.sobjects).to.include('Case');
      expect(result.fields).to.include('Case.CaseNumber');
      expect(result.templateVariables).to.include('flowResult');
    });

    /**
     * @ac US-025-AC-5: Link to dependent metadata
     */
    it('US-025-AC-5: should link to all dependent metadata', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <developerName>CompletePrompt</developerName>
    <masterLabel>Complete Prompt</masterLabel>
    <description>Full featured prompt</description>
    <relatedEntity>Opportunity</relatedEntity>
    <relatedField>Amount</relatedField>
    <status>Published</status>
    <type>einstein_gpt__flex_v2</type>
    <templateVersions>
        <content>Analyze {!Opportunity.Amount} for {!Account.Name}</content>
        <number>1</number>
        <primaryModel>sfdc_ai__DefaultGPT4</primaryModel>
        <templateDataProviders>
            <apiName>OppProvider</apiName>
            <object>Opportunity</object>
            <fields>
                <apiName>Amount</apiName>
            </fields>
            <fields>
                <apiName>StageName</apiName>
            </fields>
        </templateDataProviders>
        <templateDataProviders>
            <apiName>AccProvider</apiName>
            <object>Account</object>
            <fields>
                <apiName>Name</apiName>
            </fields>
        </templateDataProviders>
        <templateVersionVariables>
            <developerName>targetValue</developerName>
            <type>Number</type>
        </templateVersionVariables>
        <templateVersionVariables>
            <developerName>context</developerName>
            <type>Text</type>
        </templateVersionVariables>
    </templateVersions>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'Complete_Prompt.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'Complete_Prompt');

      // Verify all dependencies are captured
      expect(result.dependencies.sobjects).to.include.members(['Opportunity', 'Account']);
      expect(result.dependencies.fields).to.include.members([
        'Opportunity.Amount',
        'Opportunity.StageName',
        'Account.Name',
      ]);
      expect(result.dependencies.models).to.include('sfdc_ai__DefaultGPT4');
      expect(result.dependencies.dataProviders).to.include.members(['OppProvider', 'AccProvider']);
      expect(result.templateVariables).to.include.members(['targetValue', 'context']);
    });

    it('should handle prompt with no versions', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <developerName>EmptyPrompt</developerName>
    <masterLabel>Empty Prompt</masterLabel>
    <status>Draft</status>
</GenAiPromptTemplate>`;

      const filePath = join(testDir, 'Empty_Prompt.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      const result = await parseGenAiPrompt(filePath, 'Empty_Prompt');

      expect(result.models).to.be.an('array').with.lengthOf(0);
      expect(result.sobjects).to.be.an('array').with.lengthOf(0);
      expect(result.fields).to.be.an('array').with.lengthOf(0);
      expect(result.templateVariables).to.be.an('array').with.lengthOf(0);
    });

    it('should throw error for invalid XML', async () => {
      const xmlContent = '<InvalidXML>';
      const filePath = join(testDir, 'Invalid.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseGenAiPrompt(filePath, 'Invalid');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
      }
    });

    it('should throw error for missing GenAiPromptTemplate root element', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<SomeOtherRoot>
    <masterLabel>Invalid</masterLabel>
</SomeOtherRoot>`;

      const filePath = join(testDir, 'Invalid_Structure.genAiPromptTemplate-meta.xml');
      await writeFile(filePath, xmlContent);

      try {
        await parseGenAiPrompt(filePath, 'Invalid_Structure');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).to.exist;
        expect((error as Error).message).to.match(/missing GenAiPromptTemplate root element/);
      }
    });
  });
});

