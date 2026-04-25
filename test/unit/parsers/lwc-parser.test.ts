import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseLWC } from '../../../src/parsers/lwc-parser.js';

describe('LWC Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple LWC component', () => {
      const code = `
        import { LightningElement } from 'lwc';

        export default class MyComponent extends LightningElement {
          connectedCallback() {
            console.log('Component initialized');
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.componentName).to.equal('myComponent');
      expect(result.isTypeScript).to.be.false;
      expect(result.apexImports).to.have.lengthOf(0);
      expect(result.lwcImports).to.have.lengthOf(0);
    });
  });

  describe('Apex Imports', () => {
    /**
     * @ac US-016-AC-1: Extract Apex imports (@salesforce/apex)
     */
    it('should extract Apex imports', () => {
      const code = `
        import getAccounts from '@salesforce/apex/AccountController.getAccounts';
        import { LightningElement } from 'lwc';

        export default class MyComponent extends LightningElement {
          accounts;

          connectedCallback() {
            getAccounts()
              .then(result => {
                this.accounts = result;
              });
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apexImports).to.have.lengthOf(1);
      expect(result.apexImports).to.include('AccountController.getAccounts');
    });

    it('should extract multiple Apex imports', () => {
      const code = `
        import getAccounts from '@salesforce/apex/AccountController.getAccounts';
        import createAccount from '@salesforce/apex/AccountController.createAccount';
        import deleteAccount from '@salesforce/apex/AccountController.deleteAccount';

        export default class MyComponent extends LightningElement {}
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apexImports).to.have.lengthOf(3);
      expect(result.apexImports).to.include.members([
        'AccountController.getAccounts',
        'AccountController.createAccount',
        'AccountController.deleteAccount',
      ]);
    });

    it('should handle destructured Apex imports', () => {
      const code = `
        import { getAccounts, createAccount } from '@salesforce/apex/AccountController';

        export default class MyComponent extends LightningElement {}
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apexImports).to.have.lengthOf(1);
      expect(result.apexImports).to.include('AccountController');
    });
  });

  describe('LWC Imports', () => {
    /**
     * @ac US-016-AC-2: Extract LWC imports (c/componentName)
     */
    it('should extract LWC imports', () => {
      const code = `
        import BaseComponent from 'c/baseComponent';
        import UtilComponent from 'c/utilComponent';

        export default class MyComponent extends BaseComponent {}
      `;

      const result = parseLWC('myComponent', code);

      expect(result.lwcImports).to.have.lengthOf(2);
      expect(result.lwcImports).to.include.members(['baseComponent', 'utilComponent']);
    });

    it('should handle destructured LWC imports', () => {
      const code = `
        import { formatCurrency, formatDate } from 'c/utilityFunctions';

        export default class MyComponent extends LightningElement {}
      `;

      const result = parseLWC('myComponent', code);

      expect(result.lwcImports).to.have.lengthOf(1);
      expect(result.lwcImports).to.include('utilityFunctions');
    });
  });

  describe('Wire Adapter Usage', () => {
    /**
     * @ac US-016-AC-3: Extract wire adapter usage
     */
    it('should extract wire adapter usage', () => {
      const code = `
        import { LightningElement, wire } from 'lwc';
        import { getRecord } from 'lightning/uiRecordApi';

        export default class MyComponent extends LightningElement {
          @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
          record;
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.wireAdapters).to.have.lengthOf(1);
      expect(result.wireAdapters).to.include('getRecord');
    });

    it('should extract multiple wire adapters', () => {
      const code = `
        import { LightningElement, wire } from 'lwc';
        import { getRecord } from 'lightning/uiRecordApi';
        import { getObjectInfo } from 'lightning/uiObjectInfoApi';
        import getAccounts from '@salesforce/apex/AccountController.getAccounts';

        export default class MyComponent extends LightningElement {
          @wire(getRecord, { recordId: '$recordId' })
          record;

          @wire(getObjectInfo, { objectApiName: 'Account' })
          objectInfo;

          @wire(getAccounts)
          accounts;
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.wireAdapters).to.have.lengthOf(3);
      expect(result.wireAdapters).to.include.members(['getRecord', 'getObjectInfo', 'getAccounts']);
    });
  });

  describe('API Properties', () => {
    /**
     * @ac US-016-AC-4: Extract @api property dependencies
     */
    it('should extract @api properties', () => {
      const code = `
        import { LightningElement, api } from 'lwc';

        export default class MyComponent extends LightningElement {
          @api recordId;
          @api objectApiName;
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apiProperties).to.have.lengthOf(2);
      expect(result.apiProperties).to.include.members(['recordId', 'objectApiName']);
    });

    it('should extract @api methods', () => {
      const code = `
        import { LightningElement, api } from 'lwc';

        export default class MyComponent extends LightningElement {
          @api refresh() {
            // Refresh logic
          }

          @api validate() {
            return true;
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apiProperties).to.have.lengthOf(2);
      expect(result.apiProperties).to.include.members(['refresh', 'validate']);
    });

    it('should extract @api getters and setters using the property name', () => {
      const code = `
        import { LightningElement, api } from 'lwc';

        export default class MyComponent extends LightningElement {
          _recordId;

          @api
          get recordId() {
            return this._recordId;
          }

          set recordId(value) {
            this._recordId = value;
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apiProperties).to.deep.equal(['recordId']);
    });
  });

  describe('Navigation References', () => {
    /**
     * @ac US-016-AC-5: Extract navigation references
     */
    it('should detect NavigationMixin usage', () => {
      const code = `
        import { LightningElement } from 'lwc';
        import { NavigationMixin } from 'lightning/navigation';

        export default class MyComponent extends NavigationMixin(LightningElement) {
          navigateToAccount() {
            this[NavigationMixin.Navigate]({
              type: 'standard__recordPage',
              attributes: { recordId: this.recordId }
            });
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.navigationRefs.length).to.be.at.least(1);
      expect(result.navigationRefs).to.include('lightning/navigation');
    });

    it('should detect navigation without NavigationMixin import', () => {
      const code = `
        export default class MyComponent extends NavigationMixin(LightningElement) {
          navigateToHome() {
            this[NavigationMixin.Navigate]({ type: 'standard__home' });
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.navigationRefs).to.include('NavigationMixin');
    });
  });

  describe('TypeScript Detection', () => {
    /**
     * @ac US-016-AC-6: Handle TypeScript components
     */
    it('should detect TypeScript components with type annotations', () => {
      const code = `
        import { LightningElement } from 'lwc';

        export default class MyComponent extends LightningElement {
          private recordId: string;
          private count: number = 0;

          handleClick(): void {
            this.count++;
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.isTypeScript).to.be.true;
    });

    it('should detect TypeScript components with interfaces', () => {
      const code = `
        import { LightningElement } from 'lwc';

        interface AccountData {
          name: string;
          industry: string;
        }

        export default class MyComponent extends LightningElement {
          private data: AccountData;
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.isTypeScript).to.be.true;
    });

    it('should not detect JavaScript as TypeScript', () => {
      const code = `
        import { LightningElement } from 'lwc';

        export default class MyComponent extends LightningElement {
          recordId;
          count = 0;

          handleClick() {
            this.count++;
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.isTypeScript).to.be.false;
    });

    it('should preserve string and template literal content that contains comment markers', () => {
      const code = `
        import getAccounts from '@salesforce/apex/AccountController.getAccounts';
        import { LightningElement, api } from 'lwc';

        export default class MyComponent extends LightningElement {
          url = 'https://example.com/path';
          template = \`/* keep me */\`;

          // Fake import in comment: import bad from 'c/notReal';
          @api recordId;
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apexImports).to.include('AccountController.getAccounts');
      expect(result.apiProperties).to.include('recordId');
      expect(result.lwcImports).to.not.include('notReal');
    });
  });

  describe('Metadata XML Parsing', () => {
    /**
     * @ac US-016-AC-8: Parse js-meta.xml correctly
     * TODO: Re-enable when metadata XML parsing is fully implemented
     */
    it('should parse js-meta.xml and extract exposure targets', () => {
      const jsCode = 'export default class MyComponent extends LightningElement {}';
      const metadataXml = `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>60.0</apiVersion>
  <isExposed>true</isExposed>
  <targets>
    <target>lightning__AppPage</target>
    <target>lightning__RecordPage</target>
  </targets>
</LightningComponentBundle>`;

      const result = parseLWC('myComponent', jsCode, metadataXml);

      expect(result.hasMetadataXml).to.be.true;
      expect(result.metadata?.apiVersion).to.equal('60');
      expect(result.metadata?.isExposed).to.equal(true);
      expect(result.metadata?.targets?.target).to.include('lightning__AppPage');
      expect(result.metadata?.targets?.target).to.include('lightning__RecordPage');
    });

    it('should handle missing metadata XML', () => {
      const jsCode = 'export default class MyComponent extends LightningElement {}';

      const result = parseLWC('myComponent', jsCode);

      expect(result.hasMetadataXml).to.be.false;
      expect(result.metadata).to.be.undefined;
    });

    it('should handle invalid metadata XML gracefully', () => {
      const jsCode = 'export default class MyComponent extends LightningElement {}';
      const metadataXml = 'invalid xml content';

      const result = parseLWC('myComponent', jsCode, metadataXml);

      expect(result.hasMetadataXml).to.be.true;
      expect(result.metadata).to.be.undefined;
    });
  });

  describe('Comments Removal', () => {
    it('should remove single-line comments', () => {
      const code = `
        // import FakeApex from '@salesforce/apex/FakeController.fakeMethod';
        import RealApex from '@salesforce/apex/RealController.realMethod';
        // import FakeLWC from 'c/fakeComponent';

        export default class MyComponent extends LightningElement {}
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apexImports).to.include('RealController.realMethod');
      expect(result.apexImports).to.not.include('FakeController.fakeMethod');
    });

    it('should remove multi-line comments', () => {
      const code = `
        /*
         * import FakeApex from '@salesforce/apex/FakeController.fakeMethod';
         * import FakeLWC from 'c/fakeComponent';
         */
        import RealApex from '@salesforce/apex/RealController.realMethod';

        export default class MyComponent extends LightningElement {}
      `;

      const result = parseLWC('myComponent', code);

      expect(result.apexImports).to.include('RealController.realMethod');
      expect(result.apexImports).to.not.include('FakeController.fakeMethod');
      expect(result.lwcImports).to.not.include('fakeComponent');
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a comprehensive LWC with multiple dependencies', () => {
      const code = `
        import { LightningElement, api, wire, track } from 'lwc';
        import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
        import { getObjectInfo } from 'lightning/uiObjectInfoApi';
        import { NavigationMixin } from 'lightning/navigation';
        import getAccounts from '@salesforce/apex/AccountController.getAccounts';
        import createAccount from '@salesforce/apex/AccountController.createAccount';
        import BaseComponent from 'c/baseComponent';
        import { formatCurrency } from 'c/utilityFunctions';

        const FIELDS = ['Account.Name', 'Account.Industry'];

        export default class AccountManager extends NavigationMixin(BaseComponent) {
          @api recordId;
          @api objectApiName;
          @track accounts = [];

          @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
          record;

          @wire(getObjectInfo, { objectApiName: 'Account' })
          objectInfo;

          @wire(getAccounts)
          wiredAccounts({ error, data }) {
            if (data) {
              this.accounts = data;
            }
          }

          @api
          async refresh() {
            const result = await getAccounts();
            this.accounts = result;
          }

          handleNavigate() {
            this[NavigationMixin.Navigate]({
              type: 'standard__recordPage',
              attributes: { recordId: this.recordId }
            });
          }
        }
      `;

      const result = parseLWC('accountManager', code);

      expect(result.componentName).to.equal('accountManager');

      // Apex imports
      expect(result.apexImports).to.have.lengthOf(2);
      expect(result.apexImports).to.include.members([
        'AccountController.getAccounts',
        'AccountController.createAccount',
      ]);

      // LWC imports
      expect(result.lwcImports).to.have.lengthOf(2);
      expect(result.lwcImports).to.include.members(['baseComponent', 'utilityFunctions']);

      // Wire adapters
      expect(result.wireAdapters).to.have.lengthOf(3);
      expect(result.wireAdapters).to.include.members(['getRecord', 'getObjectInfo', 'getAccounts']);

      // API properties
      expect(result.apiProperties.length).to.be.at.least(2);
      expect(result.apiProperties).to.include.members(['recordId', 'objectApiName']);

      // Navigation
      expect(result.navigationRefs.length).to.be.at.least(1);

      // Total dependencies
      expect(result.dependencies.length).to.be.greaterThan(5);
    });

    it('should parse TypeScript LWC with type annotations', () => {
      const code = `
        import { LightningElement, api } from 'lwc';
        import getAccounts from '@salesforce/apex/AccountController.getAccounts';

        interface Account {
          Id: string;
          Name: string;
        }

        export default class MyComponent extends LightningElement {
          @api recordId: string;
          private accounts: Account[] = [];

          async loadAccounts(): Promise<void> {
            this.accounts = await getAccounts();
          }
        }
      `;

      const result = parseLWC('myComponent', code);

      expect(result.isTypeScript).to.be.true;
      expect(result.apexImports).to.include('AccountController.getAccounts');
      expect(result.apiProperties).to.include('recordId');
    });
  });

  describe('Bundle Structure Validation', () => {
    /**
     * @ac US-016-AC-7: Validate bundle structure (js, html, xml)
     */
    it('should parse component with metadata XML', () => {
      const jsCode = `
        import { LightningElement } from 'lwc';
        export default class MyComponent extends LightningElement {}
      `;

      const metadataXml = `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>60.0</apiVersion>
  <isExposed>true</isExposed>
  <targets>
    <target>lightning__AppPage</target>
  </targets>
</LightningComponentBundle>`;

      const result = parseLWC('myComponent', jsCode, metadataXml);

      expect(result.hasMetadataXml).to.be.true;
      expect(result.metadata?.isExposed).to.equal(true);
      expect(result.metadata?.targets?.target).to.deep.equal(['lightning__AppPage']);
    });

    it('should handle multiple targets in metadata XML', () => {
      const jsCode = 'export default class MyComponent extends LightningElement {}';
      const metadataXml = `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <targets>
    <target>lightning__AppPage</target>
    <target>lightning__RecordPage</target>
    <target>lightning__HomePage</target>
  </targets>
</LightningComponentBundle>`;

      const result = parseLWC('myComponent', jsCode, metadataXml);

      expect(result.metadata?.targets?.target).to.include('lightning__AppPage');
      expect(result.metadata?.targets?.target).to.include('lightning__RecordPage');
      expect(result.metadata?.targets?.target).to.include('lightning__HomePage');
    });

    it('should parse target configs and capabilities from metadata XML', () => {
      const jsCode = 'export default class MyComponent extends LightningElement {}';
      const metadataXml = `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>61.0</apiVersion>
  <isExposed>true</isExposed>
  <masterLabel>My Component</masterLabel>
  <targets>
    <target>lightning__RecordPage</target>
  </targets>
  <targetConfigs>
    <targetConfig targets="lightning__RecordPage">
      <objects>
        <object>Account</object>
        <object>Contact</object>
      </objects>
      <property name="recordId" type="String" required="true" label="Record Id" />
      <supportedFormFactors>
        <supportedFormFactor type="Small" />
        <supportedFormFactor type="Large" />
      </supportedFormFactors>
    </targetConfig>
  </targetConfigs>
  <capabilities>
    <capability>sfdc:allow_guest_access</capability>
  </capabilities>
</LightningComponentBundle>`;

      const result = parseLWC('myComponent', jsCode, metadataXml);

      expect(result.metadata?.masterLabel).to.equal('My Component');
      expect(result.metadata?.targetConfigs).to.have.lengthOf(1);
      expect(result.metadata?.targetConfigs?.[0].targets).to.equal('lightning__RecordPage');
      expect(result.metadata?.targetConfigs?.[0].objects?.map((object) => object.object)).to.deep.equal([
        'Account',
        'Contact',
      ]);
      expect(result.metadata?.targetConfigs?.[0].property?.[0]).to.deep.include({
        name: 'recordId',
        type: 'String',
        required: true,
        label: 'Record Id',
      });
      expect(
        result.metadata?.targetConfigs?.[0].supportedFormFactors?.map((formFactor) => formFactor.type)
      ).to.deep.equal(['Small', 'Large']);
      expect(result.metadata?.capabilities).to.deep.equal(['sfdc:allow_guest_access']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty component', () => {
      const code = 'export default class EmptyComponent extends LightningElement {}';

      const result = parseLWC('emptyComponent', code);

      expect(result.componentName).to.equal('emptyComponent');
      expect(result.dependencies).to.have.lengthOf(0);
    });

    it('should deduplicate imports', () => {
      const code = `
        import getAccounts from '@salesforce/apex/AccountController.getAccounts';
        import BaseComponent from 'c/baseComponent';

        export default class MyComponent extends BaseComponent {
          @wire(getAccounts)
          accounts;
        }
      `;

      const result = parseLWC('myComponent', code);

      // getAccounts appears in both apex_import and wire_adapter
      const apexImportDeps = result.dependencies.filter((d) => d.type === 'apex_import');
      const wireDeps = result.dependencies.filter((d) => d.type === 'wire_adapter');

      expect(apexImportDeps).to.have.lengthOf(1);
      expect(wireDeps).to.have.lengthOf(1);
    });

    it('should handle component names with underscores', () => {
      const code = 'export default class MyComponent extends LightningElement {}';

      const result = parseLWC('my_custom_component', code);

      expect(result.componentName).to.equal('my_custom_component');
    });
  });
});
