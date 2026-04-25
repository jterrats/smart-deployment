import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseApexClass } from '../../../src/parsers/apex-class-parser.js';
import { ParsingError } from '../../../src/errors/parsing-error.js';

describe('Apex Class Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple Apex class', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            System.debug('Hello World');
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      expect(result.className).to.equal('MyController');
      expect(result.extends).to.be.undefined;
      expect(result.implements).to.have.lengthOf(0);
      expect(result.innerClasses).to.have.lengthOf(0);
    });

    it('should throw ParsingError for invalid file name', () => {
      const code = 'public class Test {}';

      expect(() => parseApexClass('InvalidName.txt', code)).to.throw(ParsingError);
      expect(() => parseApexClass('NoExtension', code)).to.throw(ParsingError);
    });
  });

  describe('Extends Relationships', () => {
    /**
     * @ac US-013-AC-1: Extract extends relationships
     */
    it('should extract extends relationship', () => {
      const code = `
        public class MyController extends BaseController {
          public void doSomething() {}
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      expect(result.extends).to.equal('BaseController');
      expect(result.dependencies).to.deep.include({
        type: 'extends',
        className: 'BaseController',
        namespace: undefined,
        isStandard: false,
        isManagedPackage: false,
      });
    });

    it('should handle extends with generic types', () => {
      const code = `
        public class MyController extends BaseController<Account, Contact> {
          public void doSomething() {}
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      expect(result.extends).to.equal('BaseController');
    });

    it('should not include extends for standard classes', () => {
      const code = `
        public class MyException extends Exception {
          public MyException(String message) {
            super(message);
          }
        }
      `;

      const result = parseApexClass('MyException.cls', code);

      expect(result.extends).to.equal('Exception');
      // Standard classes should not be in dependencies
      const extendsDepencencies = result.dependencies.filter((d) => d.type === 'extends');
      expect(extendsDepencencies).to.have.lengthOf(0);
    });
  });

  describe('Implements Relationships', () => {
    /**
     * @ac US-013-AC-2: Extract implements relationships
     */
    it('should extract single implements relationship', () => {
      const code = `
        public class MyBatch implements Database.Batchable<SObject> {
          public Database.QueryLocator start(Database.BatchableContext BC) {
            return Database.getQueryLocator('SELECT Id FROM Account');
          }
        }
      `;

      const result = parseApexClass('MyBatch.cls', code);

      // Generic types are cleaned, so we expect 'Database.Batchable' not 'Database.Batchable<SObject>'
      expect(result.implements).to.include('Database.Batchable');
    });

    it('should extract multiple implements relationships', () => {
      const code = `
        public class MyService implements IService, ICallable, ILoggable {
          public Object call(String action, Map<String, Object> args) {
            return null;
          }
        }
      `;

      const result = parseApexClass('MyService.cls', code);

      expect(result.implements).to.have.lengthOf(3);
      expect(result.implements).to.include('IService');
      expect(result.implements).to.include('ICallable');
      expect(result.implements).to.include('ILoggable');
    });

    it('should not duplicate interfaces', () => {
      const code = `
        public class MyClass implements IService, IService {
          public void execute() {}
        }
      `;

      const result = parseApexClass('MyClass.cls', code);

      // Should dedupe
      expect(result.implements).to.have.lengthOf(1);
      expect(result.implements).to.include('IService');
    });
  });

  describe('Static Method Calls', () => {
    /**
     * @ac US-013-AC-3: Extract static method calls
     */
    it('should extract static method calls', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            String result = MyUtility.formatString('test');
            Integer count = AnotherUtility.getCount();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const staticCalls = result.dependencies.filter((d) => d.type === 'static_method');
      expect(staticCalls).to.have.lengthOf(2);
      expect(staticCalls.map((d) => d.className)).to.include.members(['MyUtility', 'AnotherUtility']);
    });

    /**
     * @ac US-013-AC-7: Ignore standard classes (System.*, etc.)
     */
    it('should ignore standard static method calls', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            System.debug('test');
            Database.insert(records);
            Schema.getGlobalDescribe();
            Test.startTest();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const staticCalls = result.dependencies.filter((d) => d.type === 'static_method');
      // Should not include System, Database, Schema, Test
      expect(staticCalls).to.have.lengthOf(0);
    });

    it('should handle namespaced static calls', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            MyNamespace.MyUtility.doSomething();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const staticCalls = result.dependencies.filter((d) => d.type === 'static_method');
      expect(staticCalls).to.have.lengthOf(1);
      expect(staticCalls[0].className).to.equal('MyUtility');
      expect(staticCalls[0].namespace).to.equal('MyNamespace');
    });

    it('should preserve string literals containing URL-like content while ignoring commented dependencies', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            String endpoint = 'https://example.com/services';
            // FakeUtility.process();
            RealUtility.process();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const staticCalls = result.dependencies.filter((d) => d.type === 'static_method');
      expect(staticCalls.map((d) => d.className)).to.include('RealUtility');
      expect(staticCalls.map((d) => d.className)).to.not.include('FakeUtility');
    });
  });

  describe('Object Instantiations', () => {
    /**
     * @ac US-013-AC-4: Extract object instantiations
     */
    it('should extract new object instantiations', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            MyService service = new MyService();
            AnotherService another = new AnotherService('param');
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const instantiations = result.dependencies.filter((d) => d.type === 'instantiation');
      expect(instantiations).to.have.lengthOf(2);
      expect(instantiations.map((d) => d.className)).to.include.members(['MyService', 'AnotherService']);
    });

    it('should extract instantiations with generic types', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            List<Account> accounts = new List<Account>();
            Map<String, Object> data = new Map<String, Object>();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      // List and Map are standard classes, should be ignored
      const instantiations = result.dependencies.filter((d) => d.type === 'instantiation');
      expect(instantiations).to.have.lengthOf(0);
    });
  });

  describe('Variable Declarations', () => {
    /**
     * @ac US-013-AC-5: Extract variable declarations
     */
    it('should extract variable declarations', () => {
      const code = `
        public class MyController {
          private MyService service;
          private AnotherService another = null;

          public void doSomething() {
            MyUtility util;
            ThirdService third = getService();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const varDecls = result.dependencies.filter((d) => d.type === 'variable_declaration');
      expect(varDecls.length).to.be.at.least(3);
      const classNames = varDecls.map((d) => d.className);
      expect(classNames).to.include.members(['MyService', 'AnotherService', 'MyUtility']);
    });

    it('should not extract standard variable declarations', () => {
      const code = `
        public class MyController {
          private String name;
          private Integer count;
          private Boolean isActive;
          private Date today;
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const varDecls = result.dependencies.filter((d) => d.type === 'variable_declaration');
      // Standard types should be ignored
      expect(varDecls).to.have.lengthOf(0);
    });
  });

  describe('Inner Classes', () => {
    /**
     * @ac US-013-AC-6: Handle inner classes
     */
    it('should extract inner classes', () => {
      const code = `
        public class MyController {
          public class InnerService {
            public void doSomething() {}
          }

          private class PrivateHelper {
            public String format(String input) {
              return input;
            }
          }

          public void doSomething() {}
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      expect(result.innerClasses).to.have.lengthOf(2);
      expect(result.innerClasses).to.include.members(['InnerService', 'PrivateHelper']);
    });

    it('should not include the outer class as an inner class', () => {
      const code = `
        public class MyController {
          public class InnerService {
            public void doSomething() {}
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      expect(result.innerClasses).to.have.lengthOf(1);
      expect(result.innerClasses).to.not.include('MyController');
    });
  });

  describe('Managed Packages', () => {
    /**
     * @ac US-013-AC-8: Handle managed packages
     */
    it('should detect managed package classes', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            MyPackage__MyService.execute();
            AnotherPkg__Utility.format('test');
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const managedDeps = result.dependencies.filter((d) => d.isManagedPackage);
      expect(managedDeps).to.have.lengthOf(2);

      const myServiceDep = managedDeps.find((d) => d.className === 'MyService');
      expect(myServiceDep).to.exist;
      expect(myServiceDep!.namespace).to.equal('MyPackage');
      expect(myServiceDep!.isManagedPackage).to.be.true;
    });

    it('should handle namespace in class name', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            CustomNamespace.MyUtility.doSomething();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const dep = result.dependencies.find((d) => d.className === 'MyUtility');
      expect(dep).to.exist;
      expect(dep!.namespace).to.equal('CustomNamespace');
      expect(dep!.isManagedPackage).to.be.false;
    });
  });

  describe('Comments Removal', () => {
    /**
     * @ac US-013-AC-9: Remove comments before parsing
     */
    it('should remove single-line comments', () => {
      const code = `
        public class MyController {
          // This is a comment with MyFakeClass reference
          public void doSomething() {
            // Another comment with AnotherFakeClass
            MyRealClass.execute(); // Inline comment with InlineFakeClass
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const staticCalls = result.dependencies.filter((d) => d.type === 'static_method');
      expect(staticCalls).to.have.lengthOf(1);
      expect(staticCalls[0].className).to.equal('MyRealClass');

      // Should not extract classes from comments
      const allClassNames = result.dependencies.map((d) => d.className);
      expect(allClassNames).to.not.include('MyFakeClass');
      expect(allClassNames).to.not.include('AnotherFakeClass');
      expect(allClassNames).to.not.include('InlineFakeClass');
    });

    it('should remove multi-line comments', () => {
      const code = `
        public class MyController {
          /* This is a multi-line comment
             with MyFakeClass reference
             and AnotherFakeClass too */
          public void doSomething() {
            MyRealClass.execute();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const allClassNames = result.dependencies.map((d) => d.className);
      expect(allClassNames).to.not.include('MyFakeClass');
      expect(allClassNames).to.not.include('AnotherFakeClass');
    });

    it('should remove JavaDoc comments', () => {
      const code = `
        /**
         * This is a JavaDoc comment
         * @param MyFakeClass some description
         * @return AnotherFakeClass
         */
        public class MyController {
          public void doSomething() {
            MyRealClass.execute();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const allClassNames = result.dependencies.map((d) => d.className);
      expect(allClassNames).to.not.include('MyFakeClass');
      expect(allClassNames).to.not.include('AnotherFakeClass');
    });
  });

  describe('Dynamic Instantiation', () => {
    /**
     * @ac US-013-AC-10: Handle Type.forName() dynamic instantiation
     */
    it('should extract Type.forName() calls', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            Type t = Type.forName('MyDynamicClass');
            Type another = Type.forName("AnotherDynamicClass");
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const dynamicInst = result.dependencies.filter((d) => d.type === 'dynamic_instantiation');
      expect(dynamicInst).to.have.lengthOf(2);
      expect(dynamicInst.map((d) => d.className)).to.include.members(['MyDynamicClass', 'AnotherDynamicClass']);
    });

    it('should handle Type.forName() with namespace', () => {
      const code = `
        public class MyController {
          public void doSomething() {
            Type t = Type.forName('MyNamespace.MyDynamicClass');
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      const dynamicInst = result.dependencies.filter((d) => d.type === 'dynamic_instantiation');
      expect(dynamicInst).to.have.lengthOf(1);
      expect(dynamicInst[0].className).to.equal('MyDynamicClass');
      expect(dynamicInst[0].namespace).to.equal('MyNamespace');
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a complex controller with multiple dependencies', () => {
      const code = `
        /**
         * Complex controller with various dependencies
         */
        public with sharing class AccountController extends BaseController implements IController, ICallable {
          // Services
          private AccountService accountService;
          private ContactService contactService;

          // Constructor
          public AccountController() {
            this.accountService = new AccountService();
            this.contactService = new ContactService();
          }

          // ICallable implementation
          public Object call(String action, Map<String, Object> args) {
            if (action == 'getAccounts') {
              return getAccounts();
            }
            return null;
          }

          // Public methods
          public List<Account> getAccounts() {
            // Use utility
            String filter = AccountUtility.buildFilter();

            // Static call
            List<Account> accounts = AccountSelector.selectAll();

            // Type.forName for dynamic instantiation
            Type handlerType = Type.forName('AccountHandler');

            return accounts;
          }

          // Inner class
          public class AccountWrapper {
            public Account record { get; set; }
            public Boolean isSelected { get; set; }
          }
        }
      `;

      const result = parseApexClass('AccountController.cls', code);

      expect(result.className).to.equal('AccountController');
      expect(result.extends).to.equal('BaseController');
      expect(result.implements).to.have.lengthOf(2);
      expect(result.implements).to.include.members(['IController', 'ICallable']);

      // Check various dependency types
      const extendsDep = result.dependencies.find((d) => d.type === 'extends');
      expect(extendsDep).to.exist;
      expect(extendsDep!.className).to.equal('BaseController');

      const implementsDeps = result.dependencies.filter((d) => d.type === 'implements');
      expect(implementsDeps).to.have.lengthOf(2);

      const varDecls = result.dependencies.filter((d) => d.type === 'variable_declaration');
      expect(varDecls.map((d) => d.className)).to.include.members(['AccountService', 'ContactService']);

      const instantiations = result.dependencies.filter((d) => d.type === 'instantiation');
      expect(instantiations.map((d) => d.className)).to.include.members(['AccountService', 'ContactService']);

      const staticCalls = result.dependencies.filter((d) => d.type === 'static_method');
      expect(staticCalls.map((d) => d.className)).to.include.members(['AccountUtility', 'AccountSelector']);

      const dynamicInst = result.dependencies.filter((d) => d.type === 'dynamic_instantiation');
      expect(dynamicInst.map((d) => d.className)).to.include('AccountHandler');

      // Check inner class
      expect(result.innerClasses).to.include('AccountWrapper');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty class', () => {
      const code = 'public class EmptyClass {}';

      const result = parseApexClass('EmptyClass.cls', code);

      expect(result.className).to.equal('EmptyClass');
      expect(result.dependencies).to.have.lengthOf(0);
      expect(result.innerClasses).to.have.lengthOf(0);
    });

    it('should handle class with only standard dependencies', () => {
      const code = `
        public class MyClass {
          public void doSomething() {
            System.debug('test');
            String s = 'test';
            Integer i = 5;
          }
        }
      `;

      const result = parseApexClass('MyClass.cls', code);

      expect(result.dependencies).to.have.lengthOf(0);
    });

    it('should deduplicate dependencies', () => {
      const code = `
        public class MyController {
          private MyService service1;
          private MyService service2;

          public void doSomething() {
            MyService.staticMethod();
            new MyService();
          }
        }
      `;

      const result = parseApexClass('MyController.cls', code);

      // MyService appears multiple times in different contexts
      // Each context (variable_declaration, static_method, instantiation) should appear once
      const myServiceDeps = result.dependencies.filter((d) => d.className === 'MyService');

      // Expect at most 3: variable_declaration, static_method, instantiation
      expect(myServiceDeps.length).to.be.at.most(3);

      // Each type should appear at most once
      const types = myServiceDeps.map((d) => d.type);
      const uniqueTypes = [...new Set(types)];
      expect(types).to.have.lengthOf(uniqueTypes.length);
    });
  });
});
