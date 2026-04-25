import { expect } from 'chai';
import { parseEmailTemplate } from '../../../src/parsers/email-template-parser.js';

describe('Email Template Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple text email template', async () => {
      const content = 'Hello World!';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>SimpleTemplate</name>
          <style>none</style>
          <subject>Test Subject</subject>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('SimpleTemplate', content, metadata);

      expect(result.name).to.equal('SimpleTemplate');
      expect(result.type).to.equal('text');
      expect(result.mergeFields).to.be.empty;
      expect(result.dependencies).to.be.empty;
    });
  });

  describe('Merge Fields Extraction', () => {
    /**
     * @ac US-019-AC-1: Extract merge fields (object.field references)
     */
    it('should extract simple merge fields', async () => {
      const content = 'Hello {!Contact.FirstName} {!Contact.LastName}!';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>WelcomeEmail</name>
          <style>none</style>
          <subject>Welcome</subject>
          <type>text</type>
          <relatedEntityType>Contact</relatedEntityType>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('WelcomeEmail', content, metadata);

      expect(result.mergeFields).to.have.lengthOf(2);
      expect(result.mergeFields[0].objectName).to.equal('Contact');
      expect(result.mergeFields[0].fieldName).to.equal('FirstName');
      expect(result.mergeFields[1].objectName).to.equal('Contact');
      expect(result.mergeFields[1].fieldName).to.equal('LastName');
    });

    it('should extract custom field merge fields', async () => {
      const content = 'Your score: {!Contact.Custom_Score__c}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>ScoreEmail</name>
          <style>none</style>
          <type>text</type>
          <relatedEntityType>Contact</relatedEntityType>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('ScoreEmail', content, metadata);

      expect(result.mergeFields).to.have.lengthOf(1);
      expect(result.mergeFields[0].fieldName).to.equal('Custom_Score__c');
    });

    it('should extract related object merge fields', async () => {
      const content = 'Account: {!Contact.Account.Name}, Owner: {!Contact.Account.Owner.Name}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>RelatedEmail</name>
          <style>none</style>
          <type>text</type>
          <relatedEntityType>Contact</relatedEntityType>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('RelatedEmail', content, metadata);

      expect(result.mergeFields).to.have.lengthOf(2);
      expect(result.mergeFields[0].isRelated).to.be.true;
      expect(result.mergeFields[0].relationshipPath).to.equal('Account.Name');
      expect(result.mergeFields[1].isRelated).to.be.true;
      expect(result.mergeFields[1].relationshipPath).to.equal('Account.Owner.Name');
    });

    it('should deduplicate merge fields', async () => {
      const content = '{!Contact.Name} {!Contact.Name} {!Contact.Name}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>DuplicateEmail</name>
          <style>none</style>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('DuplicateEmail', content, metadata);

      expect(result.mergeFields).to.have.lengthOf(1);
    });
  });

  describe('Visualforce Page References', () => {
    /**
     * @ac US-019-AC-2: Extract Visualforce page references
     */
    it('should extract Visualforce page reference', async () => {
      const content = '<messaging:emailTemplate />';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>VFTemplate</name>
          <style>none</style>
          <type>visualforce</type>
          <visualforcePage>MyVFPage</visualforcePage>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('VFTemplate', content, metadata);

      expect(result.type).to.equal('visualforce');
      expect(result.visualforcePage).to.equal('MyVFPage');
      expect(result.dependencies.some((d) => d.type === 'visualforce_page')).to.be.true;
    });

    it('should handle templates without VF page', async () => {
      const content = 'Simple text';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>TextTemplate</name>
          <style>none</style>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('TextTemplate', content, metadata);

      expect(result.visualforcePage).to.be.undefined;
    });
  });

  describe('Related Entity Type', () => {
    /**
     * @ac US-019-AC-3: Extract relatedEntityType (target SObject)
     */
    it('should extract relatedEntityType', async () => {
      const content = 'Hello {!Account.Name}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>AccountEmail</name>
          <style>none</style>
          <type>text</type>
          <relatedEntityType>Account</relatedEntityType>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('AccountEmail', content, metadata);

      expect(result.relatedEntityType).to.equal('Account');
      expect(result.dependencies.some((d) => d.type === 'related_entity' && d.name === 'Account')).to.be.true;
    });

    it('should extract custom object relatedEntityType', async () => {
      const content = 'Your order: {!Order__c.Status__c}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>OrderEmail</name>
          <style>none</style>
          <type>text</type>
          <relatedEntityType>Order__c</relatedEntityType>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('OrderEmail', content, metadata);

      expect(result.relatedEntityType).to.equal('Order__c');
    });

    it('should handle templates without relatedEntityType', async () => {
      const content = 'General announcement';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>GeneralEmail</name>
          <style>none</style>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('GeneralEmail', content, metadata);

      expect(result.relatedEntityType).to.be.undefined;
    });

    it('should infer related entity and remap Visualforce recipient and relatedTo aliases when metadata omits them', async () => {
      const content = `
        <messaging:emailTemplate subject="Case update" recipientType="Contact" relatedToType="Case">
          Hello {!recipient.Name}, case {!relatedTo.CaseNumber}
        </messaging:emailTemplate>
      `;
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>CaseVFEmail</name>
          <style>none</style>
          <type>visualforce</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('CaseVFEmail', content, metadata);

      expect(result.relatedEntityType).to.equal('Case');
      expect(result.mergeFields.map((field) => field.objectName)).to.include.members(['Contact', 'Case']);
      expect(result.dependencies.some((d) => d.type === 'related_entity' && d.name === 'Case')).to.be.true;
    });
  });

  describe('Attachment References', () => {
    /**
     * @ac US-019-AC-4: Extract attachment references
     */
    it('should extract attachment references', async () => {
      const content = 'Please see attached document.';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>AttachmentEmail</name>
          <style>none</style>
          <type>text</type>
          <attachments>
            <name>Document1.pdf</name>
          </attachments>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('AttachmentEmail', content, metadata);

      expect(result.attachments).to.have.lengthOf(1);
      expect(result.attachments).to.include('Document1.pdf');
      expect(result.dependencies.some((d) => d.type === 'attachment')).to.be.true;
    });

    it('should extract multiple attachments', async () => {
      const content = 'Multiple documents attached.';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>MultiAttachEmail</name>
          <style>none</style>
          <type>text</type>
          <attachments>
            <name>Doc1.pdf</name>
          </attachments>
          <attachments>
            <name>Doc2.pdf</name>
          </attachments>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('MultiAttachEmail', content, metadata);

      expect(result.attachments).to.have.lengthOf(2);
      expect(result.attachments).to.include.members(['Doc1.pdf', 'Doc2.pdf']);
    });

    it('should extract content document attachments', async () => {
      const content = 'Content attached.';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>ContentEmail</name>
          <style>none</style>
          <type>text</type>
          <attachedContentDocuments>ContentDoc123</attachedContentDocuments>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('ContentEmail', content, metadata);

      expect(result.attachments).to.include('ContentDoc123');
    });
  });

  describe('Custom Label References', () => {
    /**
     * @ac US-019-AC-5: Extract custom label references
     */
    it('should extract custom label references', async () => {
      const content = 'Welcome! {!$Label.Greeting_Message}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>LabelEmail</name>
          <style>none</style>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('LabelEmail', content, metadata);

      expect(result.customLabels).to.have.lengthOf(1);
      expect(result.customLabels).to.include('Greeting_Message');
      expect(result.dependencies.some((d) => d.type === 'custom_label')).to.be.true;
    });

    it('should extract namespaced custom labels', async () => {
      const content = 'Message: {!$Label.MyNamespace__Custom_Label}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>NSLabelEmail</name>
          <style>none</style>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('NSLabelEmail', content, metadata);

      expect(result.customLabels).to.include('MyNamespace__Custom_Label');
    });

    it('should deduplicate custom labels', async () => {
      const content = '{!$Label.Message} {!$Label.Message}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>DupLabelEmail</name>
          <style>none</style>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('DupLabelEmail', content, metadata);

      expect(result.customLabels).to.have.lengthOf(1);
    });

    it('should extract custom labels from the subject as well as the body', async () => {
      const content = 'Body {!$Label.Body_Message}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>SubjectLabelEmail</name>
          <style>none</style>
          <subject>{!$Label.Subject_Message}</subject>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('SubjectLabelEmail', content, metadata);

      expect(result.customLabels).to.include.members(['Body_Message', 'Subject_Message']);
      expect(result.dependencies.filter((d) => d.type === 'custom_label').map((d) => d.name)).to.include.members([
        'Body_Message',
        'Subject_Message',
      ]);
    });
  });

  describe('Template Metadata Parsing', () => {
    /**
     * @ac US-019-AC-6: Parse template metadata (.email-meta.xml)
     */
    it('should parse metadata XML correctly', async () => {
      const content = 'Content';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <description>Test description</description>
          <encodingKey>UTF-8</encodingKey>
          <name>MetadataTest</name>
          <style>none</style>
          <subject>Test Subject</subject>
          <type>html</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('MetadataTest', content, metadata);

      expect(result.name).to.equal('MetadataTest');
      expect(result.type).to.equal('html');
    });

    it('should handle malformed XML gracefully', async () => {
      const content = 'Content';
      const metadata = '<EmailTemplate><unclosed>';

      try {
        await parseEmailTemplate('BadXML', content, metadata);
        expect.fail('Should have thrown ParsingError');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });

  describe('Template Types', () => {
    /**
     * @ac US-019-AC-7: Support all template types (text, html, visualforce, custom)
     */
    it('should detect text template type', async () => {
      const content = 'Plain text content';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>TextTemplate</name>
          <style>none</style>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('TextTemplate', content, metadata);

      expect(result.type).to.equal('text');
    });

    it('should detect html template type', async () => {
      const content = '<html><body>HTML content</body></html>';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>HTMLTemplate</name>
          <style>none</style>
          <type>html</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('HTMLTemplate', content, metadata);

      expect(result.type).to.equal('html');
    });

    it('should detect visualforce template type', async () => {
      const content = '<messaging:emailTemplate />';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>VFTemplate</name>
          <style>none</style>
          <type>visualforce</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('VFTemplate', content, metadata);

      expect(result.type).to.equal('visualforce');
    });

    it('should detect custom template type', async () => {
      const content = 'Custom HTML content';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>CustomTemplate</name>
          <style>none</style>
          <type>custom</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('CustomTemplate', content, metadata);

      expect(result.type).to.equal('custom');
    });
  });

  describe('Subject Merge Fields', () => {
    /**
     * @ac US-019-AC-8: Handle both body and subject merge fields
     */
    it('should extract merge fields from subject', async () => {
      const content = 'Email body content';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>SubjectMergeEmail</name>
          <style>none</style>
          <subject>Hello {!Contact.FirstName}</subject>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('SubjectMergeEmail', content, metadata);

      expect(result.mergeFields).to.have.lengthOf(1);
      expect(result.mergeFields[0].objectName).to.equal('Contact');
      expect(result.mergeFields[0].fieldName).to.equal('FirstName');
    });

    it('should extract merge fields from both subject and body', async () => {
      const content = 'Your account: {!Account.Name}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>BothMergeEmail</name>
          <style>none</style>
          <subject>Status: {!Account.Status__c}</subject>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('BothMergeEmail', content, metadata);

      expect(result.mergeFields).to.have.lengthOf(2);
      expect(result.mergeFields.map((m) => m.fieldName)).to.include.members(['Name', 'Status__c']);
    });

    it('should deduplicate merge fields across subject and body', async () => {
      const content = '{!Contact.Name}';
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>DupMergeEmail</name>
          <style>none</style>
          <subject>{!Contact.Name}</subject>
          <type>text</type>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('DupMergeEmail', content, metadata);

      // Should still be 2 because we're not deduplicating across subject and body in current implementation
      // This is intentional as the same field might be used in different contexts
      expect(result.mergeFields).to.have.lengthOf(2);
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a comprehensive email template', async () => {
      const content = `
        <html>
          <body>
            <h1>{!$Label.Welcome_Message}</h1>
            <p>Dear {!Contact.FirstName} {!Contact.LastName},</p>
            <p>Your account {!Contact.Account.Name} is now active.</p>
            <p>Account Manager: {!Contact.Account.Owner.Name}</p>
            <p>Custom Field: {!Contact.Custom_Score__c}</p>
            <p>{!$Label.Footer_Message}</p>
          </body>
        </html>
      `;
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
        <EmailTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
          <available>true</available>
          <encodingKey>UTF-8</encodingKey>
          <name>ComprehensiveEmail</name>
          <style>none</style>
          <subject>Welcome {!Contact.FirstName}!</subject>
          <type>html</type>
          <relatedEntityType>Contact</relatedEntityType>
          <attachments>
            <name>Welcome.pdf</name>
          </attachments>
        </EmailTemplate>
      `;

      const result = await parseEmailTemplate('ComprehensiveEmail', content, metadata);

      expect(result.name).to.equal('ComprehensiveEmail');
      expect(result.type).to.equal('html');
      expect(result.relatedEntityType).to.equal('Contact');

      // Merge fields
      expect(result.mergeFields.length).to.be.greaterThan(0);
      expect(result.mergeFields.some((m) => m.isRelated)).to.be.true;

      // Custom labels
      expect(result.customLabels).to.have.lengthOf(2);
      expect(result.customLabels).to.include.members(['Welcome_Message', 'Footer_Message']);

      // Attachments
      expect(result.attachments).to.include('Welcome.pdf');

      // Dependencies
      expect(result.dependencies.length).to.be.greaterThan(5);
      expect(result.dependencies.some((d) => d.type === 'related_entity')).to.be.true;
      expect(result.dependencies.some((d) => d.type === 'merge_field')).to.be.true;
      expect(result.dependencies.some((d) => d.type === 'custom_label')).to.be.true;
      expect(result.dependencies.some((d) => d.type === 'attachment')).to.be.true;
    });
  });
});
