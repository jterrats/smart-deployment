import { expect } from 'chai';
import { parseApexTrigger } from '../../../src/parsers/apex-trigger-parser.js';
import { ParsingError } from '../../../src/errors/parsing-error.js';

describe('Apex Trigger Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple Apex trigger', () => {
      const code = `
        trigger AccountTrigger on Account (before insert, after update) {
          AccountTriggerHandler.handleBeforeInsert(Trigger.new);
          AccountTriggerHandler.handleAfterUpdate(Trigger.new, Trigger.oldMap);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.triggerName).to.equal('AccountTrigger');
      expect(result.sobjectType).to.equal('Account');
      expect(result.events).to.have.lengthOf(2);
      expect(result.events).to.include('before insert');
      expect(result.events).to.include('after update');
    });

    it('should throw ParsingError for invalid file extension', () => {
      const code = 'trigger Test on Account (before insert) {}';

      expect(() => parseApexTrigger('Test.cls', code)).to.throw(ParsingError);
      try {
        parseApexTrigger('Test.cls', code);
      } catch (error) {
        expect(error).to.be.instanceOf(ParsingError);
        const parsingError = error as ParsingError;
        expect(parsingError.message).to.match(/Test\.cls/);
      }
    });

    it('should throw ParsingError for invalid trigger declaration', () => {
      const code = 'public class NotATrigger {}';

      expect(() => parseApexTrigger('NotATrigger.trigger', code)).to.throw(ParsingError, 'Invalid trigger declaration');
    });
  });

  describe('Trigger Object Extraction', () => {
    /**
     * @ac US-014-AC-1: Extract trigger object (Account, etc.)
     */
    it('should extract trigger object for standard objects', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          System.debug('Account trigger');
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.sobjectType).to.equal('Account');
    });

    it('should extract trigger object for custom objects', () => {
      const code = `
        trigger CustomObjectTrigger on CustomObject__c (before insert) {
          System.debug('Custom object trigger');
        }
      `;

      const result = parseApexTrigger('CustomObjectTrigger.trigger', code);

      expect(result.sobjectType).to.equal('CustomObject__c');
    });

    it('should extract trigger object for namespaced custom objects', () => {
      const code = `
        trigger NamespacedTrigger on MyNamespace__CustomObject__c (before insert) {
          System.debug('Namespaced trigger');
        }
      `;

      const result = parseApexTrigger('NamespacedTrigger.trigger', code);

      expect(result.sobjectType).to.equal('MyNamespace__CustomObject__c');
    });
  });

  describe('Handler Class References', () => {
    /**
     * @ac US-014-AC-2: Extract handler class references
     * @ac US-014-AC-4: Link trigger to handler classes
     */
    it('should extract handler class references', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          AccountTriggerHandler.handleBeforeInsert(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers).to.have.lengthOf(1);
      expect(result.handlers[0].className).to.equal('AccountTriggerHandler');
      expect(result.handlers[0].type).to.equal('handler');
    });

    /**
     * @ac US-014-AC-5: Handle multiple handlers per trigger
     */
    it('should handle multiple handlers per trigger', () => {
      const code = `
        trigger AccountTrigger on Account (before insert, after update) {
          AccountTriggerHandler.handleBeforeInsert(Trigger.new);
          AccountValidationHandler.validate(Trigger.new);
          AccountSharingHandler.updateSharing(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers).to.have.lengthOf(3);
      expect(result.handlers.map((h) => h.className)).to.include.members([
        'AccountTriggerHandler',
        'AccountValidationHandler',
        'AccountSharingHandler',
      ]);
    });

    it('should not include standard classes as handlers', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          System.debug('test');
          Database.insert(records);
          AccountTriggerHandler.handle(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers).to.have.lengthOf(1);
      expect(result.handlers[0].className).to.equal('AccountTriggerHandler');
      // System and Database should not be in handlers
      expect(result.handlers.map((h) => h.className)).to.not.include('System');
      expect(result.handlers.map((h) => h.className)).to.not.include('Database');
    });

    it('should handle namespaced handlers', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          MyNamespace.AccountTriggerHandler.handle(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers).to.have.lengthOf(1);
      expect(result.handlers[0].className).to.equal('AccountTriggerHandler');
      expect(result.handlers[0].namespace).to.equal('MyNamespace');
    });

    it('should detect managed package handlers', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          MyPackage__Handler.process(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers).to.have.lengthOf(1);
      expect(result.handlers[0].className).to.equal('Handler');
      expect(result.handlers[0].namespace).to.equal('MyPackage');
      expect(result.handlers[0].isManagedPackage).to.be.true;
    });
  });

  describe('Trigger Events', () => {
    /**
     * @ac US-014-AC-3: Detect trigger events (before insert, etc.)
     */
    it('should detect before insert event', () => {
      const code = 'trigger Test on Account (before insert) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.include('before insert');
    });

    it('should detect before update event', () => {
      const code = 'trigger Test on Account (before update) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.include('before update');
    });

    it('should detect before delete event', () => {
      const code = 'trigger Test on Account (before delete) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.include('before delete');
    });

    it('should detect after insert event', () => {
      const code = 'trigger Test on Account (after insert) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.include('after insert');
    });

    it('should detect after update event', () => {
      const code = 'trigger Test on Account (after update) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.include('after update');
    });

    it('should detect after delete event', () => {
      const code = 'trigger Test on Account (after delete) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.include('after delete');
    });

    it('should detect after undelete event', () => {
      const code = 'trigger Test on Account (after undelete) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.include('after undelete');
    });

    it('should detect multiple events', () => {
      const code = 'trigger Test on Account (before insert, before update, after insert, after update) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.have.lengthOf(4);
      expect(result.events).to.include.members(['before insert', 'before update', 'after insert', 'after update']);
    });

    it('should handle events with varying whitespace', () => {
      const code = 'trigger Test on Account (  before insert  ,  after update  ) {}';
      const result = parseApexTrigger('Test.trigger', code);

      expect(result.events).to.have.lengthOf(2);
      expect(result.events).to.include.members(['before insert', 'after update']);
    });
  });

  describe('Variable Declarations', () => {
    /**
     * @ac US-014-AC-6: Extract variable declarations
     */
    it('should extract variable declarations', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          AccountService service = new AccountService();
          AccountValidator validator;
          AccountTriggerHandler.handle(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      const varDecls = result.dependencies.filter((d) => d.type === 'variable_declaration');
      expect(varDecls.length).to.be.at.least(2);
      expect(varDecls.map((d) => d.className)).to.include.members(['AccountService', 'AccountValidator']);
    });

    it('should not extract standard type variable declarations', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          String name = 'test';
          Integer count = 5;
          Boolean isActive = true;
          AccountService service = new AccountService();
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      const varDecls = result.dependencies.filter((d) => d.type === 'variable_declaration');
      // Should only include AccountService, not String, Integer, Boolean
      expect(varDecls.map((d) => d.className)).to.not.include('String');
      expect(varDecls.map((d) => d.className)).to.not.include('Integer');
      expect(varDecls.map((d) => d.className)).to.not.include('Boolean');
    });
  });

  describe('Comments Removal', () => {
    it('should remove single-line comments', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          // FakeHandler.process(Trigger.new);
          RealHandler.process(Trigger.new); // Inline comment with AnotherFakeHandler
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers.map((h) => h.className)).to.include('RealHandler');
      expect(result.handlers.map((h) => h.className)).to.not.include('FakeHandler');
      expect(result.handlers.map((h) => h.className)).to.not.include('AnotherFakeHandler');
    });

    it('should remove multi-line comments', () => {
      const code = `
        trigger AccountTrigger on Account (before insert) {
          /* 
           * FakeHandler.process(Trigger.new);
           * AnotherFakeHandler.handle();
           */
          RealHandler.process(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers.map((h) => h.className)).to.include('RealHandler');
      expect(result.handlers.map((h) => h.className)).to.not.include('FakeHandler');
      expect(result.handlers.map((h) => h.className)).to.not.include('AnotherFakeHandler');
    });

    it('should remove JavaDoc comments', () => {
      const code = `
        /**
         * Account trigger
         * @param FakeHandler handler
         */
        trigger AccountTrigger on Account (before insert) {
          RealHandler.process(Trigger.new);
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.handlers.map((h) => h.className)).to.include('RealHandler');
      expect(result.handlers.map((h) => h.className)).to.not.include('FakeHandler');
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should parse a complex trigger with multiple handlers and events', () => {
      const code = `
        /**
         * Comprehensive Account trigger
         * Handles all DML events with multiple handler classes
         */
        trigger AccountTrigger on Account (before insert, before update, before delete, after insert, after update, after delete, after undelete) {
          // Services
          AccountService accountService = new AccountService();
          AccountValidator validator = new AccountValidator();

          // Before events
          if (Trigger.isBefore) {
            if (Trigger.isInsert) {
              AccountTriggerHandler.handleBeforeInsert(Trigger.new);
              AccountValidationHandler.validateBeforeInsert(Trigger.new);
            } else if (Trigger.isUpdate) {
              AccountTriggerHandler.handleBeforeUpdate(Trigger.new, Trigger.oldMap);
              AccountValidationHandler.validateBeforeUpdate(Trigger.new, Trigger.oldMap);
            } else if (Trigger.isDelete) {
              AccountTriggerHandler.handleBeforeDelete(Trigger.old);
            }
          }

          // After events
          if (Trigger.isAfter) {
            if (Trigger.isInsert) {
              AccountTriggerHandler.handleAfterInsert(Trigger.new);
              AccountSharingHandler.updateSharing(Trigger.new);
            } else if (Trigger.isUpdate) {
              AccountTriggerHandler.handleAfterUpdate(Trigger.new, Trigger.oldMap);
              AccountSharingHandler.updateSharing(Trigger.new);
            } else if (Trigger.isDelete) {
              AccountTriggerHandler.handleAfterDelete(Trigger.old);
            } else if (Trigger.isUndelete) {
              AccountTriggerHandler.handleAfterUndelete(Trigger.new);
            }
          }
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      expect(result.triggerName).to.equal('AccountTrigger');
      expect(result.sobjectType).to.equal('Account');

      // Check events
      expect(result.events).to.have.lengthOf(7);
      expect(result.events).to.include.members([
        'before insert',
        'before update',
        'before delete',
        'after insert',
        'after update',
        'after delete',
        'after undelete',
      ]);

      // Check handlers
      expect(result.handlers.length).to.be.at.least(3);
      expect(result.handlers.map((h) => h.className)).to.include.members([
        'AccountTriggerHandler',
        'AccountValidationHandler',
        'AccountSharingHandler',
      ]);

      // Check variable declarations
      const varDecls = result.dependencies.filter((d) => d.type === 'variable_declaration');
      expect(varDecls.map((d) => d.className)).to.include.members(['AccountService', 'AccountValidator']);
    });

    it('should handle trigger with framework pattern', () => {
      const code = `
        trigger OpportunityTrigger on Opportunity (before insert, before update, after insert, after update) {
          TriggerDispatcher.run(new OpportunityTriggerHandler());
        }
      `;

      const result = parseApexTrigger('OpportunityTrigger.trigger', code);

      expect(result.triggerName).to.equal('OpportunityTrigger');
      expect(result.sobjectType).to.equal('Opportunity');
      expect(result.handlers.map((h) => h.className)).to.include.members([
        'TriggerDispatcher',
        'OpportunityTriggerHandler',
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trigger', () => {
      const code = 'trigger EmptyTrigger on Account (before insert) {}';

      const result = parseApexTrigger('EmptyTrigger.trigger', code);

      expect(result.triggerName).to.equal('EmptyTrigger');
      expect(result.sobjectType).to.equal('Account');
      expect(result.events).to.include('before insert');
      expect(result.handlers).to.have.lengthOf(0);
    });

    it('should handle trigger with only System.debug calls', () => {
      const code = `
        trigger DebugTrigger on Account (before insert) {
          System.debug('Before insert');
          System.debug(Trigger.new);
        }
      `;

      const result = parseApexTrigger('DebugTrigger.trigger', code);

      expect(result.handlers).to.have.lengthOf(0);
    });

    it('should deduplicate handler references', () => {
      const code = `
        trigger AccountTrigger on Account (before insert, after insert) {
          AccountTriggerHandler.handleBeforeInsert(Trigger.new);
          AccountTriggerHandler.handleAfterInsert(Trigger.new);
          AccountTriggerHandler.handleAfterInsert(Trigger.new); // Duplicate call
        }
      `;

      const result = parseApexTrigger('AccountTrigger.trigger', code);

      // Should only appear once despite multiple calls
      const handlers = result.handlers.filter((h) => h.className === 'AccountTriggerHandler');
      expect(handlers).to.have.lengthOf(1);
    });

    it('should handle trigger name different from file name', () => {
      const code = 'trigger MyCustomTrigger on Account (before insert) {}';

      const result = parseApexTrigger('DifferentFileName.trigger', code);

      expect(result.triggerName).to.equal('MyCustomTrigger');
    });
  });
});
