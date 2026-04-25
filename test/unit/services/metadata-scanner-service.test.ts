import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';

describe('MetadataScannerService', () => {
  const tempDirectories: string[] = [];

  async function createProjectFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'metadata-scanner-service-'));
    tempDirectories.push(projectRoot);

    await writeFile(
      path.join(projectRoot, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '61.0',
        },
        null,
        2
      )
    );

    await mkdir(path.join(projectRoot, 'force-app', 'main', 'default', 'classes'), { recursive: true });
    await mkdir(path.join(projectRoot, 'force-app', 'main', 'default', 'lwc', 'accountCard'), { recursive: true });

    await writeFile(
      path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'AccountService.cls'),
      `public with sharing class AccountService {
  public static String loadName() {
    return 'Acme';
  }
}`
    );

    await writeFile(
      path.join(projectRoot, 'force-app', 'main', 'default', 'lwc', 'accountCard', 'accountCard.js'),
      `import { LightningElement } from 'lwc';
import loadName from '@salesforce/apex/AccountService.loadName';

export default class AccountCard extends LightningElement {
  connectedCallback() {
    void loadName();
  }
}`
    );

    await writeFile(
      path.join(projectRoot, 'force-app', 'main', 'default', 'lwc', 'accountCard', 'accountCard.js-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>61.0</apiVersion>
  <isExposed>true</isExposed>
  <targets>
    <target>lightning__RecordPage</target>
  </targets>
</LightningComponentBundle>`
    );

    return projectRoot;
  }

  async function createSecurityMetadataFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'metadata-scanner-security-'));
    tempDirectories.push(projectRoot);

    await writeFile(
      path.join(projectRoot, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '61.0',
        },
        null,
        2
      )
    );

    const profileDir = path.join(projectRoot, 'force-app', 'main', 'default', 'profiles');
    const permissionSetDir = path.join(projectRoot, 'force-app', 'main', 'default', 'permissionsets');
    await mkdir(profileDir, { recursive: true });
    await mkdir(permissionSetDir, { recursive: true });

    await writeFile(
      path.join(profileDir, 'Admin.profile-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <custom>true</custom>
  <classAccesses>
    <apexClass>AccountService</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <layoutAssignments>
    <layout>Account-Account Layout</layout>
  </layoutAssignments>
  <pageAccesses>
    <apexPage>AccountConsole</apexPage>
    <enabled>true</enabled>
  </pageAccesses>
  <applicationVisibilities>
    <application>Sales</application>
    <default>false</default>
    <visible>true</visible>
  </applicationVisibilities>
  <tabVisibilities>
    <tab>standard-Account</tab>
    <visibility>DefaultOn</visibility>
  </tabVisibilities>
</Profile>`
    );

    await writeFile(
      path.join(permissionSetDir, 'Sales.permissionset-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Sales</label>
  <classAccesses>
    <apexClass>AccountService</apexClass>
    <enabled>true</enabled>
  </classAccesses>
  <pageAccesses>
    <apexPage>AccountConsole</apexPage>
    <enabled>true</enabled>
  </pageAccesses>
  <applicationVisibilities>
    <application>Sales</application>
    <default>false</default>
    <visible>true</visible>
  </applicationVisibilities>
  <tabSettings>
    <tab>standard-Account</tab>
    <visibility>Visible</visibility>
  </tabSettings>
</PermissionSet>`
    );

    return projectRoot;
  }

  async function createDependencyRichFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'metadata-scanner-rich-'));
    tempDirectories.push(projectRoot);

    await writeFile(
      path.join(projectRoot, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '61.0',
        },
        null,
        2
      )
    );

    const baseDir = path.join(projectRoot, 'force-app', 'main', 'default');
    await Promise.all([
      mkdir(path.join(baseDir, 'customMetadata', 'Order_Config__mdt'), { recursive: true }),
      mkdir(path.join(baseDir, 'email'), { recursive: true }),
      mkdir(path.join(baseDir, 'layouts'), { recursive: true }),
      mkdir(path.join(baseDir, 'flexipages'), { recursive: true }),
      mkdir(path.join(baseDir, 'bots'), { recursive: true }),
      mkdir(path.join(baseDir, 'pages'), { recursive: true }),
    ]);

    await writeFile(
      path.join(baseDir, 'customMetadata', 'Order_Config__mdt', 'Order_Config__mdt.md-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Order Config</label>
  <pluralLabel>Order Configs</pluralLabel>
  <fields>
    <fullName>Related_Order__c</fullName>
    <label>Related Order</label>
    <type>MetadataRelationship</type>
    <referenceTo>Order__c</referenceTo>
  </fields>
</CustomMetadata>`
    );

    await writeFile(
      path.join(baseDir, 'customMetadata', 'Order_Config__mdt', 'Order_Config__mdt.Default.md'),
      `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Default</label>
  <values>
    <field>Related_Order__c</field>
    <value xsi:type="xsd:string" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">Order__c.Default</value>
  </values>
</CustomMetadata>`
    );

    await writeFile(
      path.join(baseDir, 'email', 'CaseUpdate'),
      `<messaging:emailTemplate subject="Update {!Case.CaseNumber}" recipientType="Contact" relatedToType="Case">
  Hello {!recipient.Name}, {!relatedTo.Subject}
</messaging:emailTemplate>`
    );

    await writeFile(
      path.join(baseDir, 'email', 'CaseUpdate.email-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
  <available>true</available>
  <encodingKey>UTF-8</encodingKey>
  <name>CaseUpdate</name>
  <style>none</style>
  <type>visualforce</type>
  <visualforcePage>CaseEmailPage</visualforcePage>
</EmailTemplate>`
    );

    await writeFile(
      path.join(baseDir, 'layouts', 'Account-Console Layout.layout-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Layout xmlns="http://soap.sforce.com/2006/04/metadata">
  <layoutSections>
    <layoutColumns>
      <layoutItems>
        <field>Name</field>
      </layoutItems>
      <layoutItems>
        <page>AccountDashboard</page>
      </layoutItems>
    </layoutColumns>
  </layoutSections>
  <platformActionList>
    <platformActionListItems>
      <actionName>SendEmail</actionName>
      <actionType>QuickAction</actionType>
    </platformActionListItems>
    <platformActionListItems>
      <actionName>HelpLink</actionName>
      <actionType>ActionLink</actionType>
    </platformActionListItems>
  </platformActionList>
  <relatedContent>
    <relatedContentItems>
      <layoutItem>
        <field>Contact.Email</field>
      </layoutItem>
    </relatedContentItems>
  </relatedContent>
</Layout>`
    );

    await writeFile(
      path.join(baseDir, 'flexipages', 'Account_Record_Page.flexipage-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
  <masterLabel>Account Record Page</masterLabel>
  <sobjectType>Account</sobjectType>
  <type>RecordPage</type>
  <flexiPageRegions>
    <name>main</name>
    <type>Region</type>
    <itemInstances>
      <componentInstance>
        <componentName>c:accountSummary</componentName>
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
        <componentName>c:AccountChart</componentName>
      </componentInstance>
    </itemInstances>
  </flexiPageRegions>
  <quickActionList>
    <quickActionListItems>
      <quickActionName>SendEmail</quickActionName>
    </quickActionListItems>
  </quickActionList>
</FlexiPage>`
    );

    await writeFile(
      path.join(baseDir, 'bots', 'Support_Bot.bot-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <label>Support Bot</label>
  <botVersions>
    <botDialogs>
      <developerName>MainDialog</developerName>
      <label>Main Dialog</label>
      <botSteps>
        <type>Action</type>
        <botInvocation>
          <invocationActionName>Case_Assignment_Flow</invocationActionName>
          <invocationActionType>flow</invocationActionType>
        </botInvocation>
      </botSteps>
      <botSteps>
        <type>Action</type>
        <botInvocation>
          <invocationActionName>BotActionHandler</invocationActionName>
          <invocationActionType>apex</invocationActionType>
        </botInvocation>
      </botSteps>
      <botSteps>
        <type>Action</type>
        <botInvocation>
          <invocationActionName>CaseSummary</invocationActionName>
          <invocationActionType>prompt</invocationActionType>
        </botInvocation>
      </botSteps>
      <botSteps>
        <type>Action</type>
        <conversationRecordLookup>
          <SObjectType>Case</SObjectType>
        </conversationRecordLookup>
      </botSteps>
    </botDialogs>
  </botVersions>
</Bot>`
    );

    await writeFile(
      path.join(baseDir, 'pages', 'AccountConsole.page'),
      `<apex:page controller="AccountController" extensions="AccountExtension" standardController="Account">
  <c:ReusablePanel />
</apex:page>`
    );

    return projectRoot;
  }

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (tempDirectory) => rm(tempDirectory, { recursive: true, force: true }))
    );
  });

  it('scans registered file and directory metadata handlers', async () => {
    const projectRoot = await createProjectFixture();
    const scanner = new MetadataScannerService();

    const result = await scanner.scan({ sourcePath: projectRoot });

    const componentIds = result.components.map((component) => `${component.type}:${component.name}`);

    expect(componentIds).to.include.members(['ApexClass:AccountService', 'LightningComponentBundle:accountCard']);

    const lwcComponent = result.components.find(
      (component) => component.type === 'LightningComponentBundle' && component.name === 'accountCard'
    );

    expect(lwcComponent).to.exist;
    expect([...lwcComponent!.dependencies]).to.include('AccountService.loadName');
  });

  it('marks presentation and access dependencies as optional for security metadata', async () => {
    const projectRoot = await createSecurityMetadataFixture();
    const scanner = new MetadataScannerService();

    const result = await scanner.scan({ sourcePath: projectRoot });

    const profile = result.components.find((component) => component.type === 'Profile' && component.name === 'Admin');
    const permissionSet = result.components.find(
      (component) => component.type === 'PermissionSet' && component.name === 'Sales'
    );

    expect(profile).to.exist;
    expect(permissionSet).to.exist;
    expect([...(profile!.optionalDependencies ?? [])]).to.include.members([
      'Layout:Account-Account Layout',
      'VisualforcePage:AccountConsole',
      'LightningApp:Sales',
      'standard-Account',
    ]);
    expect([...(permissionSet!.optionalDependencies ?? [])]).to.include.members([
      'VisualforcePage:AccountConsole',
      'LightningApp:Sales',
      'standard-Account',
    ]);
    expect([...profile!.dependencies]).to.include('ApexClass:AccountService');
    expect([...permissionSet!.dependencies]).to.include('ApexClass:AccountService');
  });

  it('propagates rich parser dependencies into scanned metadata components', async () => {
    const projectRoot = await createDependencyRichFixture();
    const scanner = new MetadataScannerService();

    const result = await scanner.scan({ sourcePath: projectRoot });

    const customMetadata = result.components.find(
      (component) => component.type === 'CustomMetadata' && component.name === 'Order_Config__mdt'
    );
    const customMetadataRecord = result.components.find(
      (component) => component.type === 'CustomMetadataRecord' && component.name === 'Order_Config__mdt.Default'
    );
    const emailTemplate = result.components.find(
      (component) => component.type === 'EmailTemplate' && component.name === 'CaseUpdate'
    );
    const layout = result.components.find(
      (component) => component.type === 'Layout' && component.name === 'Account-Console Layout'
    );
    const flexipage = result.components.find(
      (component) => component.type === 'FlexiPage' && component.name === 'Account_Record_Page'
    );
    const bot = result.components.find((component) => component.type === 'Bot' && component.name === 'Support_Bot');
    const vfPage = result.components.find(
      (component) => component.type === 'VisualforcePage' && component.name === 'AccountConsole'
    );

    expect(customMetadata).to.exist;
    expect(customMetadataRecord).to.exist;
    expect(emailTemplate).to.exist;
    expect(layout).to.exist;
    expect(flexipage).to.exist;
    expect(bot).to.exist;
    expect(vfPage).to.exist;

    expect([...customMetadata!.dependencies]).to.include.members([
      'Order__c',
      'CustomMetadataRecord:Order_Config__mdt.Default',
    ]);
    expect([...customMetadataRecord!.dependencies]).to.include('CustomMetadata:Order_Config__mdt');

    expect([...emailTemplate!.dependencies]).to.include.members(['Case', 'Contact', 'VisualforcePage:CaseEmailPage']);

    expect([...layout!.dependencies]).to.include.members([
      'Account',
      'Name',
      'Contact.Email',
      'VisualforcePage:AccountDashboard',
      'QuickAction:SendEmail',
      'WebLink:HelpLink',
    ]);
    expect([...(layout!.optionalDependencies ?? [])]).to.include.members([
      'VisualforcePage:AccountDashboard',
      'QuickAction:SendEmail',
      'WebLink:HelpLink',
    ]);

    expect([...flexipage!.dependencies]).to.include.members([
      'Account',
      'c:accountSummary',
      'c:AccountChart',
      'RecordType:Enterprise',
      'QuickAction:SendEmail',
    ]);

    expect([...bot!.dependencies]).to.include.members([
      'Flow:Case_Assignment_Flow',
      'ApexClass:BotActionHandler',
      'GenAiPromptTemplate:CaseSummary',
      'Case',
    ]);

    expect([...vfPage!.dependencies]).to.include.members([
      'ApexClass:AccountController',
      'ApexClass:AccountExtension',
      'Account',
      'VisualforceComponent:c:ReusablePanel',
    ]);
  });
});
