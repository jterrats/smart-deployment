import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseAura } from '../../../src/parsers/aura-parser.js';

describe('Aura Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple Aura component', () => {
      const cmp = `
        <aura:component>
          <div>Hello World</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.componentName).to.equal('MyComponent');
      expect(result.componentType).to.equal('component');
      expect(result.dependencies).to.have.lengthOf(0);
    });

    it('should detect component type: application', () => {
      const cmp = `
        <aura:application>
          <div>My App</div>
        </aura:application>
      `;

      const result = parseAura('MyApp', cmp);

      expect(result.componentType).to.equal('application');
    });

    it('should detect component type: event', () => {
      const cmp = `
        <aura:event type="APPLICATION">
          <aura:attribute name="message" type="String"/>
        </aura:event>
      `;

      const result = parseAura('MyEvent', cmp);

      expect(result.componentType).to.equal('event');
    });

    it('should detect component type: interface', () => {
      const cmp = `
        <aura:interface description="My Interface">
          <aura:attribute name="body" type="Aura.Component[]"/>
        </aura:interface>
      `;

      const result = parseAura('MyInterface', cmp);

      expect(result.componentType).to.equal('interface');
    });
  });

  describe('Apex Controller', () => {
    /**
     * @ac US-017-AC-1: Extract controller Apex class
     */
    it('should extract Apex controller', () => {
      const cmp = `
        <aura:component controller="AccountController">
          <aura:attribute name="accounts" type="List"/>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.apexController).to.equal('AccountController');
      expect(result.dependencies).to.have.lengthOf(1);
      expect(result.dependencies[0].type).to.equal('apex_controller');
      expect(result.dependencies[0].name).to.equal('AccountController');
    });

    it('should extract namespaced Apex controller', () => {
      const cmp = `
        <aura:component controller="MyNamespace__AccountController">
          <div>Component with namespaced controller</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.apexController).to.equal('MyNamespace__AccountController');
      expect(result.dependencies[0].namespace).to.equal('MyNamespace');
    });

    it('should handle component without controller', () => {
      const cmp = `
        <aura:component>
          <div>No controller</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.apexController).to.be.undefined;
    });
  });

  describe('Child Components', () => {
    /**
     * @ac US-017-AC-3: Extract child component references
     */
    it('should extract child components with self-closing tags', () => {
      const cmp = `
        <aura:component>
          <c:ChildComponent1 />
          <c:ChildComponent2 attribute="value"/>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.childComponents).to.have.lengthOf(2);
      expect(result.childComponents).to.include.members(['c:ChildComponent1', 'c:ChildComponent2']);
    });

    it('should extract child components with open/close tags', () => {
      const cmp = `
        <aura:component>
          <c:Header>
            <c:Logo />
          </c:Header>
          <c:Body>
            <p>Content</p>
          </c:Body>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.childComponents).to.have.lengthOf(3);
      expect(result.childComponents).to.include.members(['c:Header', 'c:Logo', 'c:Body']);
    });

    it('should extract namespaced child components', () => {
      const cmp = `
        <aura:component>
          <myns:CustomComponent />
          <otherns:UtilComponent />
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.childComponents).to.have.lengthOf(2);
      expect(result.childComponents).to.include.members(['myns:CustomComponent', 'otherns:UtilComponent']);
    });

    it('should exclude aura: namespace components', () => {
      const cmp = `
        <aura:component>
          <aura:attribute name="myAttr" type="String"/>
          <c:CustomComponent />
          <aura:if isTrue="{!v.showComponent}">
            <c:AnotherComponent />
          </aura:if>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.childComponents).to.have.lengthOf(2);
      expect(result.childComponents).to.include.members(['c:CustomComponent', 'c:AnotherComponent']);
      expect(result.childComponents).to.not.include('aura:attribute');
      expect(result.childComponents).to.not.include('aura:if');
    });

    it('should exclude lightning: namespace components', () => {
      const cmp = `
        <aura:component>
          <lightning:button label="Click"/>
          <c:CustomComponent />
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.childComponents).to.have.lengthOf(1);
      expect(result.childComponents).to.include('c:CustomComponent');
      expect(result.childComponents).to.not.include('lightning:button');
    });

    it('should exclude force: namespace components', () => {
      const cmp = `
        <aura:component>
          <force:recordData />
          <c:CustomComponent />
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.childComponents).to.deep.equal(['c:CustomComponent']);
    });
  });

  describe('Events', () => {
    /**
     * @ac US-017-AC-4: Extract event references
     */
    it('should extract registered events', () => {
      const cmp = `
        <aura:component>
          <aura:registerEvent name="myEvent" type="c:MyEvent"/>
          <aura:registerEvent name="anotherEvent" type="c:AnotherEvent"/>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.events).to.have.lengthOf(2);
      expect(result.events).to.include.members(['c:MyEvent', 'c:AnotherEvent']);
    });

    it('should extract handled events', () => {
      const cmp = `
        <aura:component>
          <aura:handler event="c:AccountUpdated" action="{!c.handleAccountUpdate}"/>
          <aura:handler event="c:ContactCreated" action="{!c.handleContactCreate}"/>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.events).to.have.lengthOf(2);
      expect(result.events).to.include.members(['c:AccountUpdated', 'c:ContactCreated']);
    });

    it('should extract both registered and handled events', () => {
      const cmp = `
        <aura:component>
          <aura:registerEvent name="myEvent" type="c:MyEvent"/>
          <aura:handler event="c:ExternalEvent" action="{!c.handleExternal}"/>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.events).to.have.lengthOf(2);
      expect(result.events).to.include.members(['c:MyEvent', 'c:ExternalEvent']);
    });

    it('should deduplicate event references', () => {
      const cmp = `
        <aura:component>
          <aura:registerEvent name="myEvent" type="c:DuplicateEvent"/>
          <aura:handler event="c:DuplicateEvent" action="{!c.handleEvent}"/>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.events).to.have.lengthOf(1);
      expect(result.events).to.include('c:DuplicateEvent');
    });
  });

  describe('Interface Implementations', () => {
    /**
     * @ac US-017-AC-5: Extract interface implementations
     */
    it('should extract single interface', () => {
      const cmp = `
        <aura:component implements="flexipage:availableForAllPageTypes">
          <div>My Component</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.implementsInterfaces).to.have.lengthOf(1);
      expect(result.implementsInterfaces).to.include('flexipage:availableForAllPageTypes');
    });

    it('should extract multiple interfaces', () => {
      const cmp = `
        <aura:component implements="flexipage:availableForAllPageTypes,force:hasRecordId,force:lightningQuickAction">
          <div>My Component</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.implementsInterfaces).to.have.lengthOf(3);
      expect(result.implementsInterfaces).to.include.members([
        'flexipage:availableForAllPageTypes',
        'force:hasRecordId',
        'force:lightningQuickAction',
      ]);
    });

    it('should extract extends relationship', () => {
      const cmp = `
        <aura:component extends="c:BaseComponent">
          <div>Extended Component</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.extendsComponent).to.equal('c:BaseComponent');
      expect(result.dependencies).to.have.lengthOf(1);
      expect(result.dependencies[0].type).to.equal('extends');
    });

    it('should handle both extends and implements', () => {
      const cmp = `
        <aura:component extends="c:BaseComponent" implements="force:hasRecordId,force:hasSObjectName">
          <div>My Component</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      expect(result.extendsComponent).to.equal('c:BaseComponent');
      expect(result.implementsInterfaces).to.have.lengthOf(2);
      expect(result.dependencies).to.have.lengthOf(3); // 1 extends + 2 implements
    });
  });

  describe('Helper Dependencies', () => {
    /**
     * @ac US-017-AC-2: Extract helper dependencies
     */
    it('should detect helper file presence', () => {
      const cmp = `
        <aura:component>
          <div>Component with helper</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp, false, true, false);

      expect(result.hasHelper).to.be.true;
      expect(result.dependencies.some((d) => d.type === 'helper')).to.be.true;
      expect(result.dependencies.find((d) => d.type === 'helper')?.name).to.equal('MyComponentHelper');
    });

    it('should handle component without helper', () => {
      const cmp = `
        <aura:component>
          <div>No helper</div>
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp, false, false, false);

      expect(result.hasHelper).to.be.false;
      expect(result.dependencies.some((d) => d.type === 'helper')).to.be.false;
    });
  });

  describe('Bundle Structure', () => {
    /**
     * @ac US-017-AC-6: Validate bundle structure
     * @ac US-017-AC-7: Parse all bundle files (.cmp, .js, .css, etc.)
     */
    it('should track controller file presence', () => {
      const cmp = '<aura:component></aura:component>';

      const result = parseAura('MyComponent', cmp, true, false, false);

      expect(result.hasController).to.be.true;
    });

    it('should track helper file presence', () => {
      const cmp = '<aura:component></aura:component>';

      const result = parseAura('MyComponent', cmp, false, true, false);

      expect(result.hasHelper).to.be.true;
    });

    it('should track style file presence', () => {
      const cmp = '<aura:component></aura:component>';

      const result = parseAura('MyComponent', cmp, false, false, true);

      expect(result.hasStyle).to.be.true;
    });

    it('should track complete bundle structure', () => {
      const cmp = `
        <aura:component controller="MyController">
          <c:ChildComponent />
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp, true, true, true);

      expect(result.hasController).to.be.true;
      expect(result.hasHelper).to.be.true;
      expect(result.hasStyle).to.be.true;
      expect(result.apexController).to.equal('MyController');
      expect(result.childComponents).to.have.lengthOf(1);
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a comprehensive Aura component', () => {
      const cmp = `
        <aura:component controller="AccountController" 
                        extends="c:BaseComponent"
                        implements="flexipage:availableForAllPageTypes,force:hasRecordId">
          <aura:attribute name="recordId" type="Id"/>
          <aura:attribute name="accounts" type="List"/>
          
          <aura:registerEvent name="accountSelected" type="c:AccountSelectedEvent"/>
          <aura:handler event="c:RefreshAccounts" action="{!c.handleRefresh}"/>
          
          <div class="container">
            <c:AccountHeader recordId="{!v.recordId}"/>
            <c:AccountList accounts="{!v.accounts}"/>
            <c:AccountFooter />
          </div>
          
          <myns:CustomUtility />
        </aura:component>
      `;

      const result = parseAura('AccountManager', cmp, true, true, true);

      expect(result.componentName).to.equal('AccountManager');
      expect(result.componentType).to.equal('component');

      // Apex controller
      expect(result.apexController).to.equal('AccountController');

      // Extends
      expect(result.extendsComponent).to.equal('c:BaseComponent');

      // Implements
      expect(result.implementsInterfaces).to.have.lengthOf(2);
      expect(result.implementsInterfaces).to.include.members([
        'flexipage:availableForAllPageTypes',
        'force:hasRecordId',
      ]);

      // Child components
      expect(result.childComponents).to.have.lengthOf(4);
      expect(result.childComponents).to.include.members([
        'c:AccountHeader',
        'c:AccountList',
        'c:AccountFooter',
        'myns:CustomUtility',
      ]);

      // Events
      expect(result.events).to.have.lengthOf(2);
      expect(result.events).to.include.members(['c:AccountSelectedEvent', 'c:RefreshAccounts']);

      // Bundle structure
      expect(result.hasController).to.be.true;
      expect(result.hasHelper).to.be.true;
      expect(result.hasStyle).to.be.true;

      // Total dependencies
      expect(result.dependencies.length).to.be.greaterThan(5);
    });

    it('should parse an Aura application with multiple dependencies', () => {
      const cmp = `
        <aura:application extends="force:slds" implements="flexipage:availableForAllPageTypes">
          <aura:handler name="init" value="{!this}" action="{!c.doInit}"/>
          <aura:handler event="c:ApplicationEvent" action="{!c.handleAppEvent}"/>
          
          <c:Header />
          <div class="main-content">
            <c:Navigation />
            <c:ContentArea>
              <c:DataTable />
              <c:ChartComponent />
            </c:ContentArea>
          </div>
          <c:Footer />
        </aura:application>
      `;

      const result = parseAura('MyApplication', cmp, true, false, true);

      expect(result.componentType).to.equal('application');
      expect(result.extendsComponent).to.equal('force:slds');
      expect(result.implementsInterfaces).to.include('flexipage:availableForAllPageTypes');
      expect(result.childComponents).to.have.lengthOf(6);
      expect(result.events).to.include('c:ApplicationEvent');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty component', () => {
      const cmp = '<aura:component></aura:component>';

      const result = parseAura('EmptyComponent', cmp);

      expect(result.componentName).to.equal('EmptyComponent');
      expect(result.dependencies).to.have.lengthOf(0);
    });

    it('should handle component with only attributes', () => {
      const cmp = `
        <aura:component>
          <aura:attribute name="title" type="String"/>
          <aura:attribute name="count" type="Integer"/>
        </aura:component>
      `;

      const result = parseAura('SimpleComponent', cmp);

      expect(result.dependencies).to.have.lengthOf(0);
    });

    it('should handle component with whitespace in attributes', () => {
      const cmp = `
        <aura:component 
          controller = "MyController" 
          extends = "c:BaseComponent"
          implements = "force:hasRecordId, force:hasSObjectName">
          <div>Component</div>
        </aura:component>
      `;

      const result = parseAura('WhitespaceComponent', cmp);

      expect(result.apexController).to.equal('MyController');
      expect(result.extendsComponent).to.equal('c:BaseComponent');
      expect(result.implementsInterfaces).to.have.lengthOf(2);
    });

    it('should handle duplicate child component references', () => {
      const cmp = `
        <aura:component>
          <c:DuplicateComponent />
          <c:DuplicateComponent />
          <c:DuplicateComponent />
        </aura:component>
      `;

      const result = parseAura('MyComponent', cmp);

      // Should deduplicate
      expect(result.childComponents).to.have.lengthOf(1);
      expect(result.childComponents).to.include('c:DuplicateComponent');
    });
  });
});
