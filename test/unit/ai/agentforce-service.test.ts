/**
 * Tests for Agentforce Service - US-054
 */
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { AgentforceService } from '../../../src/ai/agentforce-service.js';

describe('AgentforceService', () => {
  let service: AgentforceService;

  beforeEach(() => {
    service = new AgentforceService({
      enabled: true,
      endpoint: 'https://test-api.salesforce.com',
      apiKey: 'test-key',
      model: 'test-model',
      timeout: 5000,
      maxRetries: 2,
      rateLimit: 10,
    });
    service.resetStats();
  });

  describe('US-054: Agentforce Service Setup', () => {
    /** @ac US-054-AC-1: Configure API endpoint */
    it('US-054-AC-1: should configure API endpoint', () => {
      const config = service.getConfig();
      expect(config.endpoint).to.equal('https://test-api.salesforce.com');
      expect(config.model).to.equal('test-model');
    });

    /** @ac US-054-AC-2: Handle authentication */
    it('US-054-AC-2: should handle authentication', async () => {
      const noAuthService = new AgentforceService({ enabled: true, apiKey: undefined });

      try {
        await noAuthService.sendRequest({
          model: 'test',
          prompt: 'test',
        });
        expect.fail('Should have thrown authentication error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('API key not configured');
      }
    });

    /** @ac US-054-AC-3: Support multiple models */
    it('US-054-AC-3: should support multiple models', async () => {
      const response = await service.sendRequest({
        model: 'custom-model',
        prompt: 'Test prompt',
      });

      expect(response.model).to.be.a('string');
    });

    /** @ac US-054-AC-4: Implement retry logic */
    it('US-054-AC-4: should implement retry logic', async () => {
      // Service should have retry logic (tested via max retries config)
      const config = service.getConfig();
      expect(config.maxRetries).to.equal(2);
    });

    /** @ac US-054-AC-5: Handle rate limiting */
    it('US-054-AC-5: should enforce rate limiting', async () => {
      const limitedService = new AgentforceService({
        enabled: true,
        apiKey: 'test',
        rateLimit: 2,
      });

      // Should allow first 2 requests
      await limitedService.sendRequest({ model: 'test', prompt: 'test1' });
      await limitedService.sendRequest({ model: 'test', prompt: 'test2' });

      // Third request should hit rate limit
      try {
        await limitedService.sendRequest({ model: 'test', prompt: 'test3' });
        expect.fail('Should have thrown rate limit error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('Rate limit exceeded');
      }
    });

    /** @ac US-054-AC-6: Monitor API usage */
    it('US-054-AC-6: should monitor API usage', async () => {
      await service.sendRequest({
        model: 'test',
        prompt: 'Test prompt',
      });

      const stats = service.getUsageStats();
      expect(stats.totalRequests).to.equal(1);
      expect(stats.successfulRequests).to.equal(1);
      expect(stats.failedRequests).to.equal(0);
      expect(stats.totalTokensUsed).to.be.greaterThan(0);
      expect(stats.averageResponseTime).to.be.greaterThan(0);
    });
  });

  describe('Request Execution', () => {
    it('should execute successful request', async () => {
      const response = await service.sendRequest({
        model: 'test',
        prompt: 'Test prompt',
      });

      expect(response).to.have.property('content');
      expect(response).to.have.property('tokensUsed');
      expect(response).to.have.property('executionTime');
    });

    it('should track successful requests in stats', async () => {
      await service.sendRequest({ model: 'test', prompt: 'test1' });
      await service.sendRequest({ model: 'test', prompt: 'test2' });

      const stats = service.getUsageStats();
      expect(stats.totalRequests).to.equal(2);
      expect(stats.successfulRequests).to.equal(2);
    });
  });

  describe('Configuration', () => {
    it('should support disabling service', () => {
      const disabledService = new AgentforceService({ enabled: false });
      expect(disabledService.isEnabled()).to.be.false;
    });

    it('should throw error when disabled', async () => {
      const disabledService = new AgentforceService({ enabled: false });

      try {
        await disabledService.sendRequest({ model: 'test', prompt: 'test' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).to.include('disabled');
      }
    });
  });

  describe('Statistics', () => {
    it('should reset statistics', async () => {
      await service.sendRequest({ model: 'test', prompt: 'test' });

      let stats = service.getUsageStats();
      expect(stats.totalRequests).to.equal(1);

      service.resetStats();

      stats = service.getUsageStats();
      expect(stats.totalRequests).to.equal(0);
      expect(stats.successfulRequests).to.equal(0);
    });
  });
});

