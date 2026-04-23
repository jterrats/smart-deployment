/**
 * Tests for Dependency Inference Service - US-055
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { DependencyInferenceService } from '../../../src/ai/dependency-inference-service.js';
import { AgentforceService, type AgentforceFetch } from '../../../src/ai/agentforce-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('DependencyInferenceService', () => {
  let service: DependencyInferenceService;
  let agentforceService: AgentforceService;
  let fetchFn: AgentforceFetch;

  beforeEach(() => {
    fetchFn = (async () =>
      new Response(
        JSON.stringify({
          content: JSON.stringify([
            {
              from: 'TestClass',
              to: 'UtilityClass',
              type: 'implicit',
              confidence: 0.91,
              reason: 'Dynamic invocation found',
            },
          ]),
          usage: { ['total_tokens']: 42 },
          model: 'test-model',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )) as AgentforceFetch;

    agentforceService = new AgentforceService({
      enabled: true,
      apiKey: 'test-key',
      rateLimit: 100,
      fetchFn,
    });
    service = new DependencyInferenceService(agentforceService, 0.7);
    service.clearCache();
  });

  const createMockComponent = (name: string, type: string): MetadataComponent => ({
    name,
    type: type as MetadataComponent['type'],
    filePath: `force-app/${name}`,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  });

  describe('US-055: AI Dependency Inference', () => {
    /** @ac US-055-AC-1: Send component context to Agentforce */
    it('US-055-AC-1: should send component context to Agentforce', async () => {
      const components = [
        createMockComponent('AccountHandler', 'ApexClass'),
        createMockComponent('AccountTrigger', 'ApexTrigger'),
      ];

      const result = await service.inferDependencies(components);

      expect(result).to.have.property('dependencies');
      expect(result).to.have.property('executionTime');
    });

    /** @ac US-055-AC-2: Receive dependency inferences */
    it('US-055-AC-2: should receive dependency inferences', async () => {
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await service.inferDependencies(components);

      expect(result.dependencies).to.be.an('array');
      expect(result.totalInferred).to.be.a('number');
    });

    /** @ac US-055-AC-3: Parse AI responses */
    it('US-055-AC-3: should parse AI responses', async () => {
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await service.inferDependencies(components);

      // Should have parsed response into structured dependencies
      if (result.dependencies.length > 0) {
        const dep = result.dependencies[0];
        expect(dep).to.have.property('from');
        expect(dep).to.have.property('to');
        expect(dep).to.have.property('type');
        expect(dep).to.have.property('confidence');
        expect(dep).to.have.property('reason');
      }
    });

    /** @ac US-055-AC-4: Confidence scoring */
    it('US-055-AC-4: should filter by confidence threshold', async () => {
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await service.inferDependencies(components);

      // All returned dependencies should meet threshold
      for (const dep of result.dependencies) {
        expect(dep.confidence).to.be.at.least(service.getConfidenceThreshold());
      }

      expect(result.highConfidenceCount).to.equal(result.dependencies.length);
    });

    /** @ac US-055-AC-5: Fallback to static analysis if AI fails */
    it('US-055-AC-5: should fallback when AI disabled', async () => {
      const disabledService = new DependencyInferenceService(new AgentforceService({ enabled: false }), 0.7);

      const components = [createMockComponent('TestClass', 'ApexClass')];
      const result = await disabledService.inferDependencies(components);

      expect(result.fallbackToStatic).to.be.true;
      expect(result.dependencies).to.be.empty;
    });

    /** @ac US-055-AC-6: Cache AI results */
    it('US-055-AC-6: should cache AI results', async () => {
      const components = [createMockComponent('TestClass', 'ApexClass')];

      // First call should not use cache
      const result1 = await service.inferDependencies(components);
      expect(result1.usedCache).to.be.false;
      expect(service.getCacheSize()).to.equal(1);

      // Second call should use cache
      const result2 = await service.inferDependencies(components);
      expect(result2.usedCache).to.be.true;
      expect(result2.dependencies).to.deep.equal(result1.dependencies);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      const components = [createMockComponent('TestClass', 'ApexClass')];
      await service.inferDependencies(components);

      expect(service.getCacheSize()).to.equal(1);

      service.clearCache();
      expect(service.getCacheSize()).to.equal(0);
    });

    it('should use different cache keys for different components', async () => {
      const components1 = [createMockComponent('ClassA', 'ApexClass')];
      const components2 = [createMockComponent('ClassB', 'ApexClass')];

      await service.inferDependencies(components1);
      await service.inferDependencies(components2);

      expect(service.getCacheSize()).to.equal(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const failingService = new AgentforceService({
        enabled: true,
        apiKey: undefined, // Will cause auth error
      });

      const inferenceService = new DependencyInferenceService(failingService, 0.7);
      const components = [createMockComponent('TestClass', 'ApexClass')];

      const result = await inferenceService.inferDependencies(components);

      expect(result.fallbackToStatic).to.be.true;
      expect(result.dependencies).to.be.empty;
    });

    it('uses repo-configured provider defaults when baseDir is supplied', async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), 'smart-deployment-inference-config-'));

      try {
        await writeFile(
          path.join(tempDir, '.smart-deployment.json'),
          JSON.stringify({
            llm: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              endpoint: 'https://api.openai.test/v1/chat/completions',
            },
          }),
          'utf8'
        );

        const inferenceService = new DependencyInferenceService(
          {
            baseDir: tempDir,
          },
          0.7
        );
        const components = [createMockComponent('TestClass', 'ApexClass')];

        const result = await inferenceService.inferDependencies(components);

        expect(result.fallbackToStatic).to.be.true;
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
