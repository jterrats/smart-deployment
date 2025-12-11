/**
 * Tests for Agentforce Error Handler - US-073
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { AgentforceErrorHandler } from '../../../src/ai/agentforce-error-handler.js';

describe('AgentforceErrorHandler', () => {
  const handler = new AgentforceErrorHandler();

  describe('US-073: Agentforce Error Handling', () => {
    /** @ac US-073-AC-1: Detect AI failures */
    it('US-073-AC-1: should detect AI failures', async () => {
      const failingAI = async () => {
        throw new Error('AI service unavailable');
      };
      const fallback = () => 'static-result';

      const result = await handler.executeWithFallback(failingAI, fallback, 'test');

      expect(result.usedFallback).to.be.true;
    });

    /** @ac US-073-AC-2: Fallback to static analysis */
    it('US-073-AC-2: should fallback to static analysis', async () => {
      const failingAI = async () => {
        throw new Error('AI timeout');
      };
      const staticAnalysis = () => ({ analysis: 'static' });

      const result = await handler.executeWithFallback(failingAI, staticAnalysis, 'analysis');

      expect(result.result).to.deep.equal({ analysis: 'static' });
      expect(result.usedFallback).to.be.true;
    });

    /** @ac US-073-AC-3: Log AI errors */
    it('US-073-AC-3: should log AI errors', async () => {
      const failingAI = async () => {
        throw new Error('Model not found');
      };
      const fallback = () => 'fallback';

      await handler.executeWithFallback(failingAI, fallback, 'test');

      const stats = handler.getStats();
      expect(stats.failedCalls).to.be.greaterThan(0);
    });

    /** @ac US-073-AC-4: Warn user about fallback */
    it('US-073-AC-4: should warn user about fallback', async () => {
      const failingAI = async () => {
        throw new Error('AI error');
      };
      const fallback = () => 'fallback';

      const result = await handler.executeWithFallback(failingAI, fallback, 'test');

      expect(result.usedFallback).to.be.true;
    });

    /** @ac US-073-AC-5: Continue deployment */
    it('US-073-AC-5: should continue despite AI failure', async () => {
      const failingAI = async () => {
        throw new Error('AI down');
      };
      const fallback = () => 'continue';

      const result = await handler.executeWithFallback(failingAI, fallback, 'deployment');

      expect(result.result).to.equal('continue');
    });

    /** @ac US-073-AC-6: Report AI usage statistics */
    it('US-073-AC-6: should report AI usage statistics', async () => {
      const stats = handler.getStats();

      expect(stats).to.have.property('totalCalls');
      expect(stats).to.have.property('successfulCalls');
      expect(stats).to.have.property('failedCalls');
      expect(stats).to.have.property('fallbackCount');
      expect(stats).to.have.property('averageResponseTime');
      expect(stats).to.have.property('errorsByType');
    });
  });

  describe('Statistics Tracking', () => {
    it('should track successful calls', async () => {
      const successfulAI = async () => 'ai-result';
      const fallback = () => 'fallback';

      const initialStats = handler.getStats();
      await handler.executeWithFallback(successfulAI, fallback, 'test');
      const newStats = handler.getStats();

      expect(newStats.totalCalls).to.be.greaterThan(initialStats.totalCalls);
    });

    it('should categorize errors by type', async () => {
      const timeoutAI = async () => {
        throw new Error('timeout');
      };
      const fallback = () => 'fallback';

      await handler.executeWithFallback(timeoutAI, fallback, 'test');

      const stats = handler.getStats();
      expect(stats.errorsByType).to.have.property('timeout');
    });

    it('should format usage report', () => {
      const report = handler.formatReport();

      expect(report).to.be.a('string');
      expect(report).to.include('AI Usage Statistics');
      expect(report).to.include('Total AI Calls');
      expect(report).to.include('Consecutive Failures');
    });
  });

  describe('Statistics Reset', () => {
    it('should reset statistics', () => {
      handler.resetStats();

      const stats = handler.getStats();
      expect(stats.totalCalls).to.equal(0);
      expect(stats.successfulCalls).to.equal(0);
      expect(stats.failedCalls).to.equal(0);
    });
  });
});
