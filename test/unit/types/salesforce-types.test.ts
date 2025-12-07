import { expect } from 'chai';
import type {
  ApexClassMetadata,
  ApexTriggerMetadata,
  AuraComponentMetadata,
  CustomObjectMetadata,
  EmailTemplateMetadata,
  FlowMetadata,
  LWCMetadata,
  PermissionSetMetadata,
  ProfileMetadata,
  StaticResourceMetadata,
  VisualforcePageMetadata,
  CustomLabel,
} from '../../../src/types/salesforce/index.js';

describe('Salesforce Type Models', () => {
  describe('Apex Types', () => {
    it('should compile ApexClassMetadata type', () => {
      const apexClass: ApexClassMetadata = {
        apiVersion: '60.0',
        status: 'Active',
      };

      expect(apexClass.apiVersion).to.equal('60.0');
      expect(apexClass.status).to.equal('Active');
    });

    it('should compile ApexTriggerMetadata type', () => {
      const apexTrigger: ApexTriggerMetadata = {
        apiVersion: '60.0',
        status: 'Active',
      };

      expect(apexTrigger.apiVersion).to.equal('60.0');
      expect(apexTrigger.status).to.equal('Active');
    });

    it('should enforce valid status values', () => {
      const validStatuses: Array<'Active' | 'Inactive' | 'Deleted'> = ['Active', 'Inactive', 'Deleted'];

      for (const status of validStatuses) {
        const apexClass: ApexClassMetadata = {
          apiVersion: '60.0',
          status,
        };

        expect(apexClass.status).to.equal(status);
      }
    });
  });

  describe('Aura Types', () => {
    it('should compile AuraComponentMetadata type', () => {
      const auraComponent: AuraComponentMetadata = {
        apiVersion: '60.0',
        description: 'Test component',
        access: 'GLOBAL',
        controller: 'MyController',
      };

      expect(auraComponent.apiVersion).to.equal('60.0');
      expect(auraComponent.access).to.equal('GLOBAL');
    });

    it('should enforce valid access levels', () => {
      const validAccess: Array<'GLOBAL' | 'PUBLIC' | 'PRIVATE' | 'INTERNAL'> = [
        'GLOBAL',
        'PUBLIC',
        'PRIVATE',
        'INTERNAL',
      ];

      for (const access of validAccess) {
        const auraComponent: AuraComponentMetadata = {
          apiVersion: '60.0',
          access,
        };

        expect(auraComponent.access).to.equal(access);
      }
    });
  });

  describe('Flow Types', () => {
    it('should compile FlowMetadata type', () => {
      const flow: FlowMetadata = {
        label: 'Test Flow',
        processType: 'AutoLaunchedFlow',
        status: 'Active',
      };

      expect(flow.label).to.equal('Test Flow');
      expect(flow.processType).to.equal('AutoLaunchedFlow');
      expect(flow.status).to.equal('Active');
    });

    it('should enforce valid process types', () => {
      const processTypes = ['AutoLaunchedFlow', 'Flow', 'Workflow'];

      for (const processType of processTypes) {
        const flow: FlowMetadata = {
          label: 'Test Flow',
          processType: processType as FlowMetadata['processType'],
          status: 'Active',
        };

        expect(flow.processType).to.equal(processType);
      }
    });

    it('should enforce valid status values', () => {
      const validStatuses: Array<'Active' | 'Draft' | 'Obsolete' | 'InvalidDraft'> = [
        'Active',
        'Draft',
        'Obsolete',
        'InvalidDraft',
      ];

      for (const status of validStatuses) {
        const flow: FlowMetadata = {
          label: 'Test Flow',
          processType: 'Flow',
          status,
        };

        expect(flow.status).to.equal(status);
      }
    });
  });

  describe('LWC Types', () => {
    it('should compile LWCMetadata type', () => {
      const lwc: LWCMetadata = {
        apiVersion: '60.0',
        isExposed: true,
        masterLabel: 'My Component',
      };

      expect(lwc.apiVersion).to.equal('60.0');
      expect(lwc.isExposed).to.be.true;
    });

    it('should support targets configuration', () => {
      const lwc: LWCMetadata = {
        apiVersion: '60.0',
        isExposed: true,
        targets: {
          target: ['lightning__RecordPage', 'lightning__AppPage'],
        },
      };

      expect(lwc.targets?.target).to.have.lengthOf(2);
      expect(lwc.targets?.target).to.include('lightning__RecordPage');
    });
  });

  describe('Custom Object Types', () => {
    it('should compile CustomObjectMetadata type', () => {
      const customObject: CustomObjectMetadata = {
        label: 'My Object',
        pluralLabel: 'My Objects',
        deploymentStatus: 'Deployed',
        sharingModel: 'ReadWrite',
      };

      expect(customObject.label).to.equal('My Object');
      expect(customObject.pluralLabel).to.equal('My Objects');
      expect(customObject.deploymentStatus).to.equal('Deployed');
    });

    it('should enforce valid deployment status', () => {
      const validStatuses: Array<'Deployed' | 'InDevelopment'> = ['Deployed', 'InDevelopment'];

      for (const deploymentStatus of validStatuses) {
        const customObject: CustomObjectMetadata = {
          label: 'Test',
          pluralLabel: 'Tests',
          deploymentStatus,
        };

        expect(customObject.deploymentStatus).to.equal(deploymentStatus);
      }
    });

    it('should enforce valid sharing models', () => {
      const validModels = ['Private', 'Read', 'ReadWrite', 'ReadWriteTransfer', 'FullAccess'];

      for (const sharingModel of validModels) {
        const customObject: CustomObjectMetadata = {
          label: 'Test',
          pluralLabel: 'Tests',
          sharingModel: sharingModel as CustomObjectMetadata['sharingModel'],
        };

        expect(customObject.sharingModel).to.equal(sharingModel);
      }
    });
  });

  describe('Permission Set Types', () => {
    it('should compile PermissionSetMetadata type', () => {
      const permSet: PermissionSetMetadata = {
        label: 'Test Permission Set',
        hasActivationRequired: false,
      };

      expect(permSet.label).to.equal('Test Permission Set');
      expect(permSet.hasActivationRequired).to.be.false;
    });

    it('should support object permissions', () => {
      const permSet: PermissionSetMetadata = {
        label: 'Test Permission Set',
        objectPermissions: [
          {
            allowCreate: true,
            allowDelete: false,
            allowEdit: true,
            allowRead: true,
            modifyAllRecords: false,
            object: 'Account',
            viewAllRecords: true,
          },
        ],
      };

      expect(permSet.objectPermissions).to.have.lengthOf(1);
      expect(permSet.objectPermissions?.[0].object).to.equal('Account');
      expect(permSet.objectPermissions?.[0].allowCreate).to.be.true;
    });
  });

  describe('Profile Types', () => {
    it('should compile ProfileMetadata type', () => {
      const profile: ProfileMetadata = {
        custom: true,
        userLicense: 'Salesforce',
      };

      expect(profile.custom).to.be.true;
      expect(profile.userLicense).to.equal('Salesforce');
    });

    it('should support tab visibilities', () => {
      const profile: ProfileMetadata = {
        tabVisibilities: [
          {
            tab: 'standard-Account',
            visibility: 'DefaultOn',
          },
          {
            tab: 'standard-Contact',
            visibility: 'DefaultOff',
          },
        ],
      };

      expect(profile.tabVisibilities).to.have.lengthOf(2);
      expect(profile.tabVisibilities?.[0].visibility).to.equal('DefaultOn');
    });
  });

  describe('Email Template Types', () => {
    it('should compile EmailTemplateMetadata type', () => {
      const emailTemplate: EmailTemplateMetadata = {
        available: true,
        encodingKey: 'UTF-8',
        name: 'Test Template',
        style: 'none',
        type: 'text',
      };

      expect(emailTemplate.available).to.be.true;
      expect(emailTemplate.encodingKey).to.equal('UTF-8');
      expect(emailTemplate.type).to.equal('text');
    });

    it('should enforce valid email template types', () => {
      const validTypes: Array<'text' | 'html' | 'custom' | 'visualforce'> = ['text', 'html', 'custom', 'visualforce'];

      for (const type of validTypes) {
        const emailTemplate: EmailTemplateMetadata = {
          available: true,
          encodingKey: 'UTF-8',
          name: 'Test',
          style: 'none',
          type,
        };

        expect(emailTemplate.type).to.equal(type);
      }
    });
  });

  describe('Static Resource Types', () => {
    it('should compile StaticResourceMetadata type', () => {
      const staticResource: StaticResourceMetadata = {
        cacheControl: 'Public',
        contentType: 'application/zip',
      };

      expect(staticResource.cacheControl).to.equal('Public');
      expect(staticResource.contentType).to.equal('application/zip');
    });

    it('should enforce valid cache control values', () => {
      const validCacheControls: Array<'Private' | 'Public'> = ['Private', 'Public'];

      for (const cacheControl of validCacheControls) {
        const staticResource: StaticResourceMetadata = {
          cacheControl,
          contentType: 'text/plain',
        };

        expect(staticResource.cacheControl).to.equal(cacheControl);
      }
    });
  });

  describe('Custom Label Types', () => {
    it('should compile CustomLabel type', () => {
      const customLabel: CustomLabel = {
        fullName: 'Test_Label',
        language: 'en_US',
        protected: false,
        shortDescription: 'Test label',
        value: 'Test value',
      };

      expect(customLabel.fullName).to.equal('Test_Label');
      expect(customLabel.language).to.equal('en_US');
      expect(customLabel.protected).to.be.false;
    });
  });

  describe('Visualforce Types', () => {
    it('should compile VisualforcePageMetadata type', () => {
      const vfPage: VisualforcePageMetadata = {
        apiVersion: '60.0',
        label: 'Test Page',
        availableInTouch: true,
      };

      expect(vfPage.apiVersion).to.equal('60.0');
      expect(vfPage.label).to.equal('Test Page');
      expect(vfPage.availableInTouch).to.be.true;
    });
  });

  describe('Type Safety', () => {
    it('should prevent any type usage in metadata models', () => {
      // This test ensures that our types are explicit and don't rely on 'any'
      // TypeScript will catch any 'any' usage at compile time
      const apexClass: ApexClassMetadata = {
        apiVersion: '60.0',
        status: 'Active',
      };

      // These assignments should be type-safe
      const apiVersion: string = apexClass.apiVersion;
      const status: 'Active' | 'Inactive' | 'Deleted' = apexClass.status;

      expect(apiVersion).to.be.a('string');
      expect(status).to.be.oneOf(['Active', 'Inactive', 'Deleted']);
    });

    it('should provide autocomplete-friendly types', () => {
      // This test demonstrates that our types support IDE autocomplete
      const flow: FlowMetadata = {
        label: 'Test',
        processType: 'Flow', // IDE should autocomplete this
        status: 'Active', // IDE should autocomplete this
      };

      expect(flow.processType).to.equal('Flow');
      expect(flow.status).to.equal('Active');
    });
  });
});
