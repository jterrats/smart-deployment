import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseVisualforce } from '../../../src/parsers/visualforce-parser.js';
import { ParsingError } from '../../../src/errors/parsing-error.js';

describe('Visualforce Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple Visualforce page', () => {
      const vf = `
        <apex:page>
          <h1>Hello World</h1>
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.name).to.equal('MyPage');
      expect(result.type).to.equal('page');
      expect(result.dependencies).to.have.lengthOf(0);
    });

    it('should parse a simple Visualforce component', () => {
      const vf = `
        <apex:component>
          <h1>My Component</h1>
        </apex:component>
      `;

      const result = parseVisualforce('MyComponent.component', vf);

      expect(result.name).to.equal('MyComponent');
      expect(result.type).to.equal('component');
      expect(result.dependencies).to.have.lengthOf(0);
    });
  });

  describe('Apex Controller', () => {
    /**
     * @ac US-018-AC-1: Extract controller Apex class
     */
    it('should extract Apex controller from page', () => {
      const vf = `
        <apex:page controller="AccountController">
          <h1>Account Page</h1>
        </apex:page>
      `;

      const result = parseVisualforce('AccountPage.page', vf);

      expect(result.apexController).to.equal('AccountController');
      expect(result.dependencies).to.have.lengthOf(1);
      expect(result.dependencies[0].type).to.equal('apex_controller');
      expect(result.dependencies[0].name).to.equal('AccountController');
    });

    it('should extract Apex controller from component', () => {
      const vf = `
        <apex:component controller="MyComponentController">
          <div>Component Content</div>
        </apex:component>
      `;

      const result = parseVisualforce('MyComponent.component', vf);

      expect(result.apexController).to.equal('MyComponentController');
      expect(result.dependencies[0].type).to.equal('apex_controller');
    });

    it('should extract namespaced Apex controller', () => {
      const vf = `
        <apex:page controller="MyNamespace__AccountController">
          <h1>Account Page</h1>
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.apexController).to.equal('MyNamespace__AccountController');
      expect(result.dependencies[0].namespace).to.equal('MyNamespace');
    });

    it('should handle page without controller', () => {
      const vf = `
        <apex:page>
          <h1>No Controller</h1>
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.apexController).to.be.undefined;
    });
  });

  describe('Standard Controller', () => {
    /**
     * @ac US-018-AC-2: Extract standardController (SObject reference)
     */
    it('should extract standard controller', () => {
      const vf = `
        <apex:page standardController="Account">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('AccountDetail.page', vf);

      expect(result.standardController).to.equal('Account');
      expect(result.dependencies).to.have.lengthOf(1);
      expect(result.dependencies[0].type).to.equal('standard_controller');
      expect(result.dependencies[0].name).to.equal('Account');
    });

    it('should extract custom object as standard controller', () => {
      const vf = `
        <apex:page standardController="MyCustomObject__c">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('CustomPage.page', vf);

      expect(result.standardController).to.equal('MyCustomObject__c');
    });

    it('should handle both controller and standardController', () => {
      const vf = `
        <apex:page standardController="Account" extensions="AccountExtension">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('AccountPage.page', vf);

      expect(result.standardController).to.equal('Account');
      expect(result.apexExtensions).to.have.lengthOf(1);
      expect(result.dependencies).to.have.lengthOf(2); // 1 standard controller + 1 extension
    });
  });

  describe('Controller Extensions', () => {
    /**
     * @ac US-018-AC-3: Extract extensions (controller extensions)
     */
    it('should extract single controller extension', () => {
      const vf = `
        <apex:page standardController="Account" extensions="AccountExtension">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('AccountPage.page', vf);

      expect(result.apexExtensions).to.have.lengthOf(1);
      expect(result.apexExtensions).to.include('AccountExtension');
      expect(result.dependencies.some((d) => d.type === 'apex_extension')).to.be.true;
    });

    it('should extract multiple controller extensions', () => {
      const vf = `
        <apex:page standardController="Account" extensions="Extension1,Extension2,Extension3">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('AccountPage.page', vf);

      expect(result.apexExtensions).to.have.lengthOf(3);
      expect(result.apexExtensions).to.include.members(['Extension1', 'Extension2', 'Extension3']);
    });

    it('should handle extensions with whitespace', () => {
      const vf = `
        <apex:page standardController="Account" extensions="Extension1, Extension2 , Extension3">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('AccountPage.page', vf);

      expect(result.apexExtensions).to.have.lengthOf(3);
      expect(result.apexExtensions).to.include.members(['Extension1', 'Extension2', 'Extension3']);
    });

    it('should extract namespaced extensions', () => {
      const vf = `
        <apex:page standardController="Account" extensions="MyNamespace__Extension1,MyNamespace__Extension2">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('AccountPage.page', vf);

      expect(result.apexExtensions).to.have.lengthOf(2);
      expect(result.dependencies.filter((d) => d.type === 'apex_extension')).to.have.lengthOf(2);
      expect(result.dependencies.filter((d) => d.namespace === 'MyNamespace')).to.have.lengthOf(2);
    });

    it('should handle page without extensions', () => {
      const vf = `
        <apex:page standardController="Account">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('AccountPage.page', vf);

      expect(result.apexExtensions).to.be.empty;
    });
  });

  describe('Visualforce Component References', () => {
    /**
     * @ac US-018-AC-4: Extract VF component references
     */
    it('should extract component references', () => {
      const vf = `
        <apex:page>
          <c:Header />
          <c:Body />
          <c:Footer />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.have.lengthOf(3);
      expect(result.components).to.include.members(['c:Header', 'c:Body', 'c:Footer']);
    });

    it('should extract namespaced components', () => {
      const vf = `
        <apex:page>
          <myns:CustomComponent />
          <otherns:UtilComponent />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.have.lengthOf(2);
      expect(result.components).to.include.members(['myns:CustomComponent', 'otherns:UtilComponent']);
    });

    it('should extract components with attributes', () => {
      const vf = `
        <apex:page>
          <c:MyComponent attribute1="value1" attribute2="value2"/>
          <c:AnotherComponent attribute="value">
            <div>Content</div>
          </c:AnotherComponent>
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.have.lengthOf(2);
      expect(result.components).to.include.members(['c:MyComponent', 'c:AnotherComponent']);
    });

    it('should exclude apex: namespace components', () => {
      const vf = `
        <apex:page>
          <apex:form>
            <apex:inputField value="{!Account.Name}" />
            <c:CustomComponent />
            <apex:commandButton value="Save" />
          </apex:form>
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.have.lengthOf(1);
      expect(result.components).to.include('c:CustomComponent');
      expect(result.components).to.not.include('apex:form');
      expect(result.components).to.not.include('apex:inputField');
    });

    it('should exclude chatter: namespace components', () => {
      const vf = `
        <apex:page>
          <chatter:feed />
          <c:CustomComponent />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.have.lengthOf(1);
      expect(result.components).to.include('c:CustomComponent');
      expect(result.components).to.not.include('chatter:feed');
    });

    it('should exclude flow: namespace components', () => {
      const vf = `
        <apex:page>
          <flow:interview name="MyFlow" />
          <c:CustomComponent />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.deep.equal(['c:CustomComponent']);
    });

    it('should deduplicate component references', () => {
      const vf = `
        <apex:page>
          <c:DuplicateComponent />
          <c:DuplicateComponent attribute="value1" />
          <c:DuplicateComponent>
            <div>Content</div>
          </c:DuplicateComponent>
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.have.lengthOf(1);
      expect(result.components).to.include('c:DuplicateComponent');
    });
  });

  describe('Page Type Detection', () => {
    /**
     * @ac US-018-AC-5: Parse both pages and components
     */
    it('should detect page type from .page extension', () => {
      const vf = '<apex:page></apex:page>';

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.type).to.equal('page');
    });

    it('should detect component type from .component extension', () => {
      const vf = '<apex:component></apex:component>';

      const result = parseVisualforce('MyComponent.component', vf);

      expect(result.type).to.equal('component');
    });
  });

  describe('File Extension Validation', () => {
    /**
     * @ac US-018-AC-6: Validate file extension (.page or .component)
     */
    it('should throw error for invalid extension', () => {
      const vf = '<apex:page></apex:page>';

      expect(() => parseVisualforce('MyPage.txt', vf)).to.throw(ParsingError);
    });

    it('should throw error for missing extension', () => {
      const vf = '<apex:page></apex:page>';

      expect(() => parseVisualforce('MyPage', vf)).to.throw(ParsingError);
    });

    it('should throw error with expected extensions in error message', () => {
      const vf = '<apex:page></apex:page>';

      try {
        parseVisualforce('MyPage.html', vf);
        expect.fail('Should have thrown ParsingError');
      } catch (error) {
        expect(error).to.be.instanceOf(ParsingError);
        expect((error as ParsingError).message).to.include('Invalid Visualforce file extension');
      }
    });
  });

  describe('Namespace Handling', () => {
    /**
     * @ac US-018-AC-7: Handle namespace prefixes in controllers and components
     */
    it('should handle namespaced controller', () => {
      const vf = `
        <apex:page controller="MyNamespace__MyController">
          <h1>Page</h1>
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.apexController).to.equal('MyNamespace__MyController');
      expect(result.dependencies[0].namespace).to.equal('MyNamespace');
    });

    it('should handle namespaced extensions', () => {
      const vf = `
        <apex:page standardController="Account" extensions="NS1__Ext1,NS2__Ext2">
          <apex:detail />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      const extensions = result.dependencies.filter((d) => d.type === 'apex_extension');
      expect(extensions).to.have.lengthOf(2);
      expect(extensions[0].namespace).to.equal('NS1');
      expect(extensions[1].namespace).to.equal('NS2');
    });

    it('should handle namespaced components', () => {
      const vf = `
        <apex:page>
          <myns:Component1 />
          <otherns:Component2 />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      const components = result.dependencies.filter((d) => d.type === 'vf_component');
      expect(components).to.have.lengthOf(2);
      expect(components[0].namespace).to.equal('myns');
      expect(components[1].namespace).to.equal('otherns');
    });

    it('should handle mixed namespaced and non-namespaced', () => {
      const vf = `
        <apex:page controller="NS__Controller" extensions="Extension1,NS__Extension2">
          <c:Component1 />
          <ns:Component2 />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      // 1 controller + 2 extensions + 2 components = 5 dependencies
      expect(result.dependencies).to.have.lengthOf(5);
      // NS__Controller, NS__Extension2, c:Component1, ns:Component2 = 4 with namespaces
      expect(result.dependencies.filter((d) => d.namespace)).to.have.lengthOf(4);
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a comprehensive Visualforce page', () => {
      const vf = `
        <apex:page standardController="Account" 
                   extensions="AccountExtension,AccountHelper" 
                   recordSetVar="accounts">
          <apex:form>
            <c:PageHeader title="Account Management" />
            <c:AccountList accounts="{!accounts}" />
            <myns:CustomTable data="{!tableData}" />
            <apex:commandButton value="Save" action="{!save}" />
          </apex:form>
          <c:PageFooter />
        </apex:page>
      `;

      const result = parseVisualforce('AccountManager.page', vf);

      expect(result.name).to.equal('AccountManager');
      expect(result.type).to.equal('page');

      // Standard controller
      expect(result.standardController).to.equal('Account');

      // Extensions
      expect(result.apexExtensions).to.have.lengthOf(2);
      expect(result.apexExtensions).to.include.members(['AccountExtension', 'AccountHelper']);

      // RecordSetVar
      expect(result.recordSetVar).to.equal('accounts');

      // Components
      expect(result.components).to.have.lengthOf(4);
      expect(result.components).to.include.members([
        'c:PageHeader',
        'c:AccountList',
        'myns:CustomTable',
        'c:PageFooter',
      ]);

      // Dependencies
      expect(result.dependencies).to.have.lengthOf(7); // 1 stdController + 2 extensions + 4 components
    });

    it('should parse a Visualforce component with controller', () => {
      const vf = `
        <apex:component controller="ComponentController">
          <apex:attribute name="title" type="String" required="true" />
          <apex:attribute name="data" type="List" />
          
          <div class="header">
            <h1>{!title}</h1>
          </div>
          
          <c:DataTable rows="{!data}" />
          <c:ChartWidget data="{!chartData}" />
        </apex:component>
      `;

      const result = parseVisualforce('MyComponent.component', vf);

      expect(result.type).to.equal('component');
      expect(result.apexController).to.equal('ComponentController');
      expect(result.components).to.have.lengthOf(2);
      expect(result.dependencies).to.have.lengthOf(3); // 1 controller + 2 components
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty page', () => {
      const vf = '<apex:page></apex:page>';

      const result = parseVisualforce('EmptyPage.page', vf);

      expect(result.name).to.equal('EmptyPage');
      expect(result.dependencies).to.be.empty;
    });

    it('should handle case-insensitive attribute matching', () => {
      const vf = `
        <apex:page Controller="MyController" Extensions="Ext1,Ext2">
          <h1>Case Test</h1>
        </apex:page>
      `;

      const result = parseVisualforce('CasePage.page', vf);

      expect(result.apexController).to.equal('MyController');
      expect(result.apexExtensions).to.have.lengthOf(2);
    });

    it('should handle whitespace in tag attributes', () => {
      const vf = `
        <apex:page
          controller = "MyController"
          extensions = "Ext1, Ext2"
          standardController = "Account"
        >
          <h1>Whitespace Test</h1>
        </apex:page>
      `;

      const result = parseVisualforce('WhitespacePage.page', vf);

      expect(result.apexController).to.equal('MyController');
      expect(result.standardController).to.equal('Account');
      expect(result.apexExtensions).to.have.lengthOf(2);
    });

    it('should handle component with no namespace prefix', () => {
      const vf = `
        <apex:page>
          <c:MyComponent />
        </apex:page>
      `;

      const result = parseVisualforce('MyPage.page', vf);

      expect(result.components).to.have.lengthOf(1);
      expect(result.dependencies[0].namespace).to.equal('c');
    });
  });
});
