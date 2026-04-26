import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  parseEmailTemplateComponent,
  parseFlexiPageComponent,
  parseLayoutComponent,
  parseVisualforceComponent,
} from '../../../src/services/scanners/experience-metadata-scanner.js';

describe('experience-metadata-scanner helpers', () => {
  const tempDirectories: string[] = [];

  async function createFixture(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'experience-metadata-scanner-'));
    tempDirectories.push(projectRoot);

    const baseDir = path.join(projectRoot, 'force-app', 'main', 'default');
    await Promise.all([
      mkdir(path.join(baseDir, 'email'), { recursive: true }),
      mkdir(path.join(baseDir, 'layouts'), { recursive: true }),
      mkdir(path.join(baseDir, 'flexipages'), { recursive: true }),
      mkdir(path.join(baseDir, 'pages'), { recursive: true }),
    ]);

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
      path.join(baseDir, 'pages', 'AccountConsole.page'),
      `<apex:page controller="AccountController" extensions="AccountExtension" standardController="Account">
  <c:ReusablePanel />
</apex:page>`
    );

    return baseDir;
  }

  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map(async (dir) => rm(dir, { recursive: true, force: true })));
  });

  it('preserves layout, flexipage, email template, and visualforce dependency mapping', async () => {
    const baseDir = await createFixture();

    const [layout, flexipage, emailTemplate, visualforcePage] = await Promise.all([
      parseLayoutComponent(path.join(baseDir, 'layouts', 'Account-Console Layout.layout-meta.xml')),
      parseFlexiPageComponent(path.join(baseDir, 'flexipages', 'Account_Record_Page.flexipage-meta.xml')),
      parseEmailTemplateComponent(
        path.join(baseDir, 'email', 'CaseUpdate.email-meta.xml'),
        async (filePath: string): Promise<boolean> => {
          try {
            await import('node:fs/promises').then(({ access }) => access(filePath));
            return true;
          } catch {
            return false;
          }
        }
      ),
      parseVisualforceComponent(path.join(baseDir, 'pages', 'AccountConsole.page')),
    ]);

    expect(layout).to.exist;
    expect(flexipage).to.exist;
    expect(emailTemplate).to.exist;
    expect(visualforcePage).to.exist;

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

    expect([...emailTemplate!.dependencies]).to.include.members(['Case', 'Contact', 'VisualforcePage:CaseEmailPage']);

    expect([...visualforcePage!.dependencies]).to.include.members([
      'ApexClass:AccountController',
      'ApexClass:AccountExtension',
      'Account',
      'VisualforceComponent:c:ReusablePanel',
    ]);
  });
});
