/**
 * Tests for Wave Validation Service - US-056
 */
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { WaveValidationService } from '../../../src/ai/wave-validation-service.js';
import { AgentforceService } from '../../../src/ai/agentforce-service.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('WaveValidationService', () => {
  let service: WaveValidationService;
  let agentforceService: AgentforceService;

  beforeEach(() => {
    agentforceService = new AgentforceService({
      enabled: true,
      apiKey: 'test-key',
    });
    service = new WaveValidationService(agentforceService);
  });

  const createMockWave = (number: number, componentCount: number): Wave => ({
    number,
    components: Array.from({ length: componentCount }, (_, i) => `Component${i}`),
    metadata: {
      componentCount,
      types: ['ApexClass' as const],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: componentCount * 0.5,
    },
  });

  describe('US-056: AI Wave Validation', () => {
    /** @ac US-056-AC-1: Send wave structure to Agentforce */
    it('US-056-AC-1: should send wave structure to Agentforce', async () => {
      const waves = [createMockWave(1, 50), createMockWave(2, 30)];

      const result = await service.validateWaves(waves);

      expect(result).to.have.property('aiAnalyzed');
      expect(result).to.have.property('executionTime');
    });

    /** @ac US-056-AC-2: Receive validation feedback */
    it('US-056-AC-2: should receive validation feedback', async () => {
      const waves = [createMockWave(1, 50)];

      const result = await service.validateWaves(waves);

      expect(result.issues).to.be.an('array');
      expect(result.optimizations).to.be.an('array');
      expect(result.riskAssessments).to.be.an('array');
    });

    /** @ac US-056-AC-3: Identify potential issues */
    it('US-056-AC-3: should identify potential issues', async () => {
      const waves = [createMockWave(1, 50)];

      const result = await service.validateWaves(waves);

      expect(result.issues).to.be.an('array');
      // Each issue should have required properties
      for (const issue of result.issues) {
        expect(issue).to.have.property('waveNumber');
        expect(issue).to.have.property('severity');
        expect(issue).to.have.property('category');
        expect(issue).to.have.property('message');
      }
    });

    /** @ac US-056-AC-4: Suggest optimizations */
    it('US-056-AC-4: should suggest optimizations', async () => {
      const waves = [createMockWave(1, 50)];

      const result = await service.validateWaves(waves);

      expect(result.optimizations).to.be.an('array');
      // Each optimization should have required properties
      for (const opt of result.optimizations) {
        expect(opt).to.have.property('waveNumber');
        expect(opt).to.have.property('type');
        expect(opt).to.have.property('confidence');
      }
    });

    /** @ac US-056-AC-5: Risk assessment per wave */
    it('US-056-AC-5: should provide risk assessment per wave', async () => {
      const waves = [createMockWave(1, 50), createMockWave(2, 30)];

      const result = await service.validateWaves(waves);

      expect(result.riskAssessments).to.be.an('array');
      expect(result.overallRisk).to.be.oneOf(['low', 'medium', 'high', 'critical']);
    });

    /** @ac US-056-AC-6: Apply AI suggestions (optional) */
    it('US-056-AC-6: should support applying optimizations', async () => {
      const waves = [createMockWave(1, 50)];
      const optimizations = [
        {
          waveNumber: 1,
          type: 'split' as const,
          description: 'Split large wave',
          confidence: 0.9,
          estimatedImprovement: '20% faster',
        },
      ];

      const optimized = service.applyOptimizations(waves, optimizations);

      expect(optimized).to.be.an('array');
      expect(optimized).to.have.lengthOf(waves.length);
    });
  });

  describe('Validation When AI Disabled', () => {
    it('should handle disabled Agentforce gracefully', async () => {
      const disabledService = new WaveValidationService(new AgentforceService({ enabled: false }));

      const waves = [createMockWave(1, 50)];
      const result = await disabledService.validateWaves(waves);

      expect(result.aiAnalyzed).to.be.false;
      expect(result.isValid).to.be.true;
    });
  });

  describe('Report Formatting', () => {
    it('should format validation report', async () => {
      const waves = [createMockWave(1, 50)];
      const result = await service.validateWaves(waves);
      const report = service.formatValidationReport(result);

      expect(report).to.be.a('string');
      expect(report).to.include('AI Wave Validation Report');
      expect(report).to.include('Overall Risk');
    });

    it('should show AI unavailable message when not analyzed', async () => {
      const disabledService = new WaveValidationService(new AgentforceService({ enabled: false }));

      const waves = [createMockWave(1, 50)];
      const result = await disabledService.validateWaves(waves);
      const report = disabledService.formatValidationReport(result);

      expect(report).to.include('AI validation unavailable');
    });
  });

  describe('Risk Calculation', () => {
    it('should calculate overall risk from assessments', async () => {
      const waves = [
        createMockWave(1, 250), // Large wave = higher risk
        createMockWave(2, 50),
      ];

      const result = await service.validateWaves(waves);

      expect(result.overallRisk).to.be.a('string');
      expect(['low', 'medium', 'high', 'critical']).to.include(result.overallRisk);
    });
  });
});
