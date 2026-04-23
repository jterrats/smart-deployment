/**
 * Tests for Agentforce Service - US-054
 */
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { AgentforceService, type AgentforceFetch } from '../../../src/ai/agentforce-service.js';

describe('AgentforceService', () => {
  let service: AgentforceService;
  let fetchCalls: Array<{ input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] }>;
  let fetchFn: AgentforceFetch;

  beforeEach(() => {
    fetchCalls = [];
    fetchFn = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      fetchCalls.push({ input, init });
      await new Promise((resolve) => {
        setTimeout(resolve, 1);
      });

      return new Response(
        JSON.stringify({
          content: JSON.stringify({
            message: 'AI response',
            confidence: 0.95,
          }),
          usage: { total_tokens: 123 },
          model: 'test-model',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as AgentforceFetch;

    service = new AgentforceService({
      enabled: true,
      endpoint: 'https://test-api.salesforce.com',
      apiKey: 'test-key',
      model: 'test-model',
      timeout: 5000,
      maxRetries: 2,
      rateLimit: 10,
      fetchFn,
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

      expect(response.model).to.equal('test-model');
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
        fetchFn,
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
      expect(stats.averageResponseTime).to.be.at.least(0);
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
      expect(fetchCalls).to.have.lengthOf(1);
      expect(String(fetchCalls[0].input)).to.equal('https://test-api.salesforce.com');
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

  describe('HTTP behavior', () => {
    it('sends authenticated JSON requests to the configured endpoint', async () => {
      await service.sendRequest({
        model: 'test-model',
        prompt: 'Prompt body',
        temperature: 0.4,
        maxTokens: 321,
      });

      expect(fetchCalls).to.have.lengthOf(1);
      expect(fetchCalls[0].init?.method).to.equal('POST');
      expect(fetchCalls[0].init?.headers).to.deep.equal({
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      });
      expect(String(fetchCalls[0].init?.body)).to.include('"prompt":"Prompt body"');
      expect(String(fetchCalls[0].init?.body)).to.include('"maxTokens":321');
    });

    it('retries retryable failures and eventually succeeds', async () => {
      let attempts = 0;
      const flakyFetch = (async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('network timeout');
        }

        return new Response(
          JSON.stringify({
            content: '{"message":"Recovered"}',
            usage: { total_tokens: 10 },
            model: 'retry-model',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as AgentforceFetch;

      const flakyService = new AgentforceService({
        enabled: true,
        apiKey: 'test-key',
        maxRetries: 2,
        fetchFn: flakyFetch,
      });

      const response = await flakyService.sendRequest({ model: 'retry-model', prompt: 'Retry me' });

      expect(response.content).to.include('Recovered');
      expect(attempts).to.equal(2);
    });
  });
});
