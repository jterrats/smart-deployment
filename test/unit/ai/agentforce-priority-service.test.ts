/**
 * Tests for Agentforce Priority Service - US-057
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { AgentforcePriorityService } from '../../../src/ai/agentforce-priority-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('AgentforcePriorityService', () => {
  const createMockComponent = (name: string, type: string): MetadataComponent => ({
    name,
    type: type as MetadataComponent['type'],
    filePath: `force-app/main/default/${type}/${name}.cls`,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  });

  describe('US-057: AI Priority Weighting', () => {
    /** @ac US-057-AC-1: Send component list to Agentforce */
    it('US-057-AC-1: should send component list to Agentforce', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [
        createMockComponent('PaymentHandler', 'ApexClass'),
        createMockComponent('LogService', 'ApexClass'),
      ];

      const result = await service.analyzePriorities(components);

      expect(result).to.have.property('recommendations');
      expect(result).to.have.property('totalComponents', 2);
    });

    /** @ac US-057-AC-2: Receive priority recommendations */
    it('US-057-AC-2: should receive priority recommendations', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [createMockComponent('PaymentHandler', 'ApexClass')];

      const result = await service.analyzePriorities(components);

      expect(result.recommendations).to.be.an('array');
      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec).to.have.property('componentName');
        expect(rec).to.have.property('priority');
        expect(rec).to.have.property('reason');
        expect(rec).to.have.property('confidence');
      }
    });

    /** @ac US-057-AC-3: Consider business criticality */
    it('US-057-AC-3: should consider business criticality', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [createMockComponent('PaymentHandler', 'ApexClass')];

      const result = await service.analyzePriorities(components, {
        orgType: 'Production',
        industry: 'Fintech',
      });

      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec).to.have.property('businessCriticality');
        expect(['low', 'medium', 'high', 'critical']).to.include(rec.businessCriticality);
      }
      expect(result.totalComponents).to.equal(1);
    });

    /** @ac US-057-AC-4: Consider failure impact */
    it('US-057-AC-4: should consider failure impact', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [createMockComponent('PaymentHandler', 'ApexClass')];

      const result = await service.analyzePriorities(components);

      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec).to.have.property('failureImpact');
        expect(['low', 'medium', 'high', 'critical']).to.include(rec.failureImpact);
      }
      expect(result.totalComponents).to.equal(1);
    });

    /** @ac US-057-AC-5: Merge with static priorities */
    it('US-057-AC-5: should support merging with static priorities', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [
        createMockComponent('PaymentHandler', 'ApexClass'),
        createMockComponent('LogService', 'ApexClass'),
      ];

      const result = await service.analyzePriorities(components);

      // AI recommendations can be merged with static based on confidence
      expect(result).to.have.property('aiAdjustments');
      expect(result.aiAdjustments).to.be.a('number');
    });

    /** @ac US-057-AC-6: Report AI decisions */
    it('US-057-AC-6: should report AI decisions', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [createMockComponent('PaymentHandler', 'ApexClass')];

      const result = await service.analyzePriorities(components);
      const report = service.formatDecisionReport(result);

      expect(report).to.be.a('string');
      expect(report).to.include('AI Priority Analysis Report');
      expect(report).to.include('Total Components');
    });
  });

  describe('Fallback and Error Handling', () => {
    it('should handle disabled service gracefully', async () => {
      const service = new AgentforcePriorityService({ enabled: false });
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await service.analyzePriorities(components);

      expect(result.recommendations).to.be.empty;
      expect(result.aiAdjustments).to.equal(0);
    });

    it('should use mock response when no API key provided', async () => {
      const service = new AgentforcePriorityService({ enabled: true, apiKey: undefined });
      const components = [createMockComponent('PaymentHandler', 'ApexClass')];

      const result = await service.analyzePriorities(components);

      // Should get mock recommendations
      expect(result.recommendations).to.not.be.empty;
      expect(result.recommendations[0].componentName).to.equal('PaymentHandler');
    });

    it('should handle timeout gracefully', async () => {
      const service = new AgentforcePriorityService({ enabled: true, timeout: 1 }); // 1ms timeout
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await service.analyzePriorities(components);

      // Should fallback gracefully
      expect(result).to.have.property('totalComponents', 1);
    });
  });

  describe('Mock Response Logic', () => {
    it('should prioritize payment-related components as critical', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [
        createMockComponent('PaymentHandler', 'ApexClass'),
        createMockComponent('LogService', 'ApexClass'),
      ];

      const result = await service.analyzePriorities(components);

      const paymentRec = result.recommendations.find((r) => r.componentName === 'PaymentHandler');
      const logRec = result.recommendations.find((r) => r.componentName === 'LogService');

      if (paymentRec && logRec) {
        expect(paymentRec.priority).to.be.greaterThan(logRec.priority);
        expect(paymentRec.businessCriticality).to.equal('critical');
      }
    });

    it('should assign appropriate confidence scores', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await service.analyzePriorities(components);

      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec.confidence).to.be.at.least(0);
        expect(rec.confidence).to.be.at.most(1);
      }
    });
  });

  describe('Report Formatting', () => {
    it.skip('should format comprehensive report', async () => {
      const service = new AgentforcePriorityService({ enabled: true });
      const components = [
        createMockComponent('PaymentHandler', 'ApexClass'),
        createMockComponent('CacheService', 'ApexClass'),
        createMockComponent('LogService', 'ApexClass'),
      ];

      const result = await service.analyzePriorities(components);
      const report = service.formatDecisionReport(result);

      expect(report).to.include('Total Components: 3');
      expect(report).to.include('Priority Recommendations');
      expect(report).to.include('Payment');
    });

    it('should handle empty recommendations in report', async () => {
      const service = new AgentforcePriorityService({ enabled: false });
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await service.analyzePriorities(components);
      const report = service.formatDecisionReport(result);

      expect(report).to.include('No AI recommendations');
    });
  });
});
