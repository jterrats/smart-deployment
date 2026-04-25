import { expect } from 'chai';
import { parseFlow } from '../../../src/parsers/flow-parser.js';
import { ParsingError } from '../../../src/errors/parsing-error.js';

describe('Flow Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple Flow', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>AutoLaunchedFlow</processType>
  <status>Active</status>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.flowName).to.equal('MyFlow');
      expect(result.flowType).to.equal('AutoLaunchedFlow');
      expect(result.status).to.equal('Active');
    });

    it('should throw ParsingError for invalid file extension', () => {
      const xml = '<Flow></Flow>';

      expect(() => parseFlow('MyFlow.xml', xml)).to.throw(ParsingError);
      expect(() => parseFlow('MyFlow.cls', xml)).to.throw(ParsingError);
    });

    it('should throw ParsingError for invalid Flow XML structure', () => {
      const xml = '<InvalidRoot></InvalidRoot>';

      expect(() => parseFlow('MyFlow.flow-meta.xml', xml)).to.throw(ParsingError, 'Invalid Flow XML structure');
    });
  });

  describe('Apex Action References', () => {
    /**
     * @ac US-015-AC-1: Extract Apex action references
     */
    it('should extract Apex action references', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>AutoLaunchedFlow</processType>
  <actionCalls>
    <name>CallApexAction</name>
    <actionType>apex</actionType>
    <actionName>MyApexClass.myMethod</actionName>
  </actionCalls>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.apexActions).to.have.lengthOf(1);
      expect(result.apexActions).to.include('MyApexClass.myMethod');
    });

    it('should extract multiple Apex actions', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>AutoLaunchedFlow</processType>
  <actionCalls>
    <name>CallApexAction1</name>
    <actionType>apex</actionType>
    <actionName>MyApexClass.method1</actionName>
  </actionCalls>
  <actionCalls>
    <name>CallApexAction2</name>
    <actionType>apex</actionType>
    <actionName>AnotherClass.method2</actionName>
  </actionCalls>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.apexActions).to.have.lengthOf(2);
      expect(result.apexActions).to.include.members(['MyApexClass.method1', 'AnotherClass.method2']);
    });

    it('should extract apex classes from plugin calls and transforms', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <apexPluginCalls>
    <name>PluginCall</name>
    <apexClass>PluginActionHandler</apexClass>
  </apexPluginCalls>
  <transforms>
    <name>TransformCall</name>
    <apexClass>TransformActionHandler</apexClass>
  </transforms>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.apexActions).to.include.members(['PluginActionHandler', 'TransformActionHandler']);
    });

    it('should not extract non-apex action types', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <actionCalls>
    <name>SendEmail</name>
    <actionType>emailAlert</actionType>
    <actionName>MyEmailAlert</actionName>
  </actionCalls>
  <actionCalls>
    <name>CallApex</name>
    <actionType>apex</actionType>
    <actionName>RealApexClass.method</actionName>
  </actionCalls>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.apexActions).to.have.lengthOf(1);
      expect(result.apexActions).to.include('RealApexClass.method');
      expect(result.apexActions).to.not.include('MyEmailAlert');
    });
  });

  describe('Subflow References', () => {
    /**
     * @ac US-015-AC-2: Extract subflow references
     */
    it('should extract subflow references', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Screen</processType>
  <subflows>
    <name>CallSubflow</name>
    <flowName>MySubflow</flowName>
  </subflows>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.subflows).to.have.lengthOf(1);
      expect(result.subflows).to.include('MySubflow');
    });

    it('should extract multiple subflows', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <subflows>
    <name>CallSubflow1</name>
    <flowName>Subflow1</flowName>
  </subflows>
  <subflows>
    <name>CallSubflow2</name>
    <flowName>Subflow2</flowName>
  </subflows>
  <subflows>
    <name>CallSubflow3</name>
    <flowName>Subflow3</flowName>
  </subflows>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.subflows).to.have.lengthOf(3);
      expect(result.subflows).to.include.members(['Subflow1', 'Subflow2', 'Subflow3']);
    });
  });

  describe('Record References', () => {
    /**
     * @ac US-015-AC-3: Extract record references (objects)
     */
    it('should extract record references from recordLookups', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <recordLookups>
    <name>GetAccount</name>
    <object>Account</object>
  </recordLookups>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.recordReferences).to.include('Account');
    });

    it('should extract record references from recordCreates', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <recordCreates>
    <name>CreateContact</name>
    <object>Contact</object>
  </recordCreates>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.recordReferences).to.include('Contact');
    });

    it('should extract record references from recordUpdates', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <recordUpdates>
    <name>UpdateOpportunity</name>
    <object>Opportunity</object>
  </recordUpdates>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.recordReferences).to.include('Opportunity');
    });

    it('should extract record references from recordDeletes', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <recordDeletes>
    <name>DeleteCase</name>
    <object>Case</object>
  </recordDeletes>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.recordReferences).to.include('Case');
    });

    it('should extract record references from start node (record-triggered)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>RecordTriggered</processType>
  <start>
    <object>Account</object>
    <recordTriggerType>Create</recordTriggerType>
  </start>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.recordReferences).to.include('Account');
    });

    it('should extract record references from SObject variables', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <variables>
    <name>accountVar</name>
    <dataType>SObject</dataType>
    <objectType>Account</objectType>
  </variables>
  <variables>
    <name>contactVar</name>
    <dataType>SObject</dataType>
    <objectType>Contact</objectType>
  </variables>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.recordReferences).to.include.members(['Account', 'Contact']);
    });

    it('should deduplicate record references', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <recordLookups>
    <name>GetAccount1</name>
    <object>Account</object>
  </recordLookups>
  <recordLookups>
    <name>GetAccount2</name>
    <object>Account</object>
  </recordLookups>
  <recordUpdates>
    <name>UpdateAccount</name>
    <object>Account</object>
  </recordUpdates>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      // Should only appear once despite multiple references
      expect(result.recordReferences.filter((r) => r === 'Account')).to.have.lengthOf(1);
    });

    it('should extract record references from dynamic choice sets', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <dynamicChoiceSets>
    <name>AccountChoices</name>
    <dataType>String</dataType>
    <displayField>Name</displayField>
    <object>Account</object>
    <picklistObject>Opportunity</picklistObject>
    <valueField>Id</valueField>
  </dynamicChoiceSets>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.recordReferences).to.include.members(['Account', 'Opportunity']);
    });
  });

  describe('GenAI Prompt References', () => {
    /**
     * @ac US-015-AC-4: Extract GenAI prompt references
     */
    it('should extract GenAI prompt references', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <actionCalls>
    <name>GenerateResponse</name>
    <actionType>genai</actionType>
    <actionName>MyGenAIPrompt</actionName>
  </actionCalls>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.genaiPrompts).to.have.lengthOf(1);
      expect(result.genaiPrompts).to.include('MyGenAIPrompt');
    });

    it('should extract prompt template API names', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <actionCalls>
    <name>UsePromptTemplate</name>
    <actionType>generateText</actionType>
    <promptTemplateApiName>MyPromptTemplate</promptTemplateApiName>
  </actionCalls>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.genaiPrompts).to.include('MyPromptTemplate');
    });

    it('should extract prompt template names from action input parameters', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <actionCalls>
    <name>UsePromptTemplate</name>
    <actionType>standardInvocableAction</actionType>
    <inputParameters>
      <name>promptTemplateApiName</name>
      <value>
        <stringValue>CaseSummaryPrompt</stringValue>
      </value>
    </inputParameters>
  </actionCalls>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.genaiPrompts).to.include('CaseSummaryPrompt');
    });

    it('should extract GenAi action types (case variations)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <actionCalls>
    <name>Action1</name>
    <actionType>GenAi</actionType>
    <actionName>Prompt1</actionName>
  </actionCalls>
  <actionCalls>
    <name>Action2</name>
    <actionType>genai_generate</actionType>
    <actionName>Prompt2</actionName>
  </actionCalls>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.genaiPrompts.length).to.be.at.least(2);
    });
  });

  describe('Screen Flow Fields', () => {
    /**
     * @ac US-015-AC-5: Extract screen flow fields
     */
    it('should extract screen flow fields', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Screen</processType>
  <screens>
    <name>Screen1</name>
    <fields>
      <name>TextField1</name>
      <dataType>String</dataType>
    </fields>
    <fields>
      <name>NumberField1</name>
      <dataType>Number</dataType>
    </fields>
  </screens>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      const screenFieldDeps = result.dependencies.filter((d) => d.type === 'screen_field');
      expect(screenFieldDeps.length).to.be.at.least(2);
    });

    it('should extract fields from multiple screens', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Screen</processType>
  <screens>
    <name>Screen1</name>
    <fields>
      <name>Field1</name>
    </fields>
  </screens>
  <screens>
    <name>Screen2</name>
    <fields>
      <name>Field2</name>
    </fields>
    <fields>
      <name>Field3</name>
    </fields>
  </screens>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      const screenFieldDeps = result.dependencies.filter((d) => d.type === 'screen_field');
      expect(screenFieldDeps.length).to.be.at.least(3);
    });
  });

  describe('Decision Logic', () => {
    /**
     * @ac US-015-AC-6: Extract decision logic
     */
    it('should extract decision nodes', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <decisions>
    <name>CheckAmount</name>
  </decisions>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      const decisionDeps = result.dependencies.filter((d) => d.type === 'decision');
      expect(decisionDeps).to.have.lengthOf(1);
      expect(decisionDeps[0].name).to.equal('CheckAmount');
    });

    it('should extract multiple decision nodes', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <decisions>
    <name>Decision1</name>
  </decisions>
  <decisions>
    <name>Decision2</name>
  </decisions>
  <decisions>
    <name>Decision3</name>
  </decisions>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      const decisionDeps = result.dependencies.filter((d) => d.type === 'decision');
      expect(decisionDeps).to.have.lengthOf(3);
    });
  });

  describe('Flow Types', () => {
    /**
     * @ac US-015-AC-7: Handle all flow types (screen, record-triggered, scheduled)
     */
    it('should identify Screen flow type', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Screen</processType>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.flowType).to.equal('Screen');
    });

    it('should identify RecordTriggered flow type', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>RecordTriggered</processType>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.flowType).to.equal('RecordTriggered');
    });

    it('should identify Scheduled flow type', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Scheduled</processType>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.flowType).to.equal('Scheduled');
    });

    it('should identify Autolaunched flow type', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Autolaunched</processType>
</Flow>`;

      const result = parseFlow('MyFlow.flow-meta.xml', xml);

      expect(result.flowType).to.equal('Autolaunched');
    });
  });

  describe('Complex Real-World Examples', () => {
    /**
     * @ac US-015-AC-8: Parse flow metadata XML correctly
     */
    it('should parse a comprehensive Flow with multiple dependency types', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>RecordTriggered</processType>
  <status>Active</status>
  <start>
    <object>Account</object>
    <recordTriggerType>Update</recordTriggerType>
  </start>
  <recordLookups>
    <name>GetRelatedContacts</name>
    <object>Contact</object>
  </recordLookups>
  <recordUpdates>
    <name>UpdateOpportunities</name>
    <object>Opportunity</object>
  </recordUpdates>
  <actionCalls>
    <name>CallApex</name>
    <actionType>apex</actionType>
    <actionName>AccountTriggerHandler.updateRelated</actionName>
  </actionCalls>
  <subflows>
    <name>RunSubflow</name>
    <flowName>AccountValidationFlow</flowName>
  </subflows>
  <decisions>
    <name>CheckAccountType</name>
  </decisions>
  <variables>
    <name>opportunityVar</name>
    <dataType>SObject</dataType>
    <objectType>Opportunity</objectType>
  </variables>
</Flow>`;

      const result = parseFlow('AccountTriggerFlow.flow-meta.xml', xml);

      expect(result.flowName).to.equal('AccountTriggerFlow');
      expect(result.flowType).to.equal('RecordTriggered');
      expect(result.status).to.equal('Active');

      // Check Apex actions
      expect(result.apexActions).to.include('AccountTriggerHandler.updateRelated');

      // Check subflows
      expect(result.subflows).to.include('AccountValidationFlow');

      // Check record references (deduplicated)
      expect(result.recordReferences).to.include.members(['Account', 'Contact', 'Opportunity']);

      // Check decisions
      const decisionDeps = result.dependencies.filter((d) => d.type === 'decision');
      expect(decisionDeps.some((d) => d.name === 'CheckAccountType')).to.be.true;

      // Check total dependencies
      expect(result.dependencies.length).to.be.greaterThan(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Flow with no dependencies', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Autolaunched</processType>
  <status>Draft</status>
</Flow>`;

      const result = parseFlow('EmptyFlow.flow-meta.xml', xml);

      expect(result.flowName).to.equal('EmptyFlow');
      expect(result.apexActions).to.have.lengthOf(0);
      expect(result.subflows).to.have.lengthOf(0);
      expect(result.recordReferences).to.have.lengthOf(0);
      expect(result.genaiPrompts).to.have.lengthOf(0);
      expect(result.dependencies).to.have.lengthOf(0);
    });

    it('should handle Flow with empty arrays', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Screen</processType>
  <actionCalls></actionCalls>
  <subflows></subflows>
</Flow>`;

      const result = parseFlow('FlowWithEmpty.flow-meta.xml', xml);

      expect(result.dependencies).to.be.an('array');
    });

    it('should extract flow name from file path correctly', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <processType>Autolaunched</processType>
</Flow>`;

      const result1 = parseFlow('MyCustomFlow.flow-meta.xml', xml);
      expect(result1.flowName).to.equal('MyCustomFlow');

      const result2 = parseFlow('Account_Update_Flow.flow-meta.xml', xml);
      expect(result2.flowName).to.equal('Account_Update_Flow');
    });
  });
});
