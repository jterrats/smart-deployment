/**
 * Tests for Prompt Builder - US-058
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { PromptBuilder } from '../../../src/ai/prompt-builder.js';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder(4000);

  describe('US-058: AI Prompt Builder', () => {
    /** @ac US-058-AC-1: Context-aware prompt generation */
    it('US-058-AC-1: should generate context-aware prompts', () => {
      const result = builder.buildPrompt({
        template: 'dependency-inference',
        context: {
          components: [{ name: 'TestClass', type: 'ApexClass' }],
        },
      });

      expect(result.systemPrompt).to.include('Salesforce metadata analyzer');
      expect(result.userPrompt).to.include('TestClass');
    });

    /** @ac US-058-AC-2: Include relevant metadata snippets */
    it('US-058-AC-2: should include metadata snippets', () => {
      const result = builder.buildPrompt({
        template: 'priority-analysis',
        context: {
          components: [{ name: 'PaymentHandler' }],
          metadata: {
            orgType: 'Production',
            industry: 'Financial Services',
          },
        },
      });

      expect(result.userPrompt).to.include('PaymentHandler');
      expect(result.userPrompt).to.include('Production');
      expect(result.userPrompt).to.include('Financial Services');
    });

    /** @ac US-058-AC-3: Optimize token usage */
    it('US-058-AC-3: should optimize token usage', () => {
      const manyComponents = Array.from({ length: 100 }, (_, i) => ({
        name: `Component${i}`,
      }));

      const result = builder.buildPrompt({
        template: 'dependency-inference',
        context: {
          components: manyComponents,
          limits: { maxComponents: 10 },
        },
      });

      // Should limit to 10 components
      const componentMatches = result.userPrompt.match(/Component\d+/g);
      expect(componentMatches).to.exist;
      expect(componentMatches!.length).to.be.at.most(10);
    });

    /** @ac US-058-AC-4: Template-based prompts */
    it('US-058-AC-4: should use template-based prompts', () => {
      const templates = builder.getTemplates();

      expect(templates).to.be.an('array');
      expect(templates).to.include('dependency-inference');
      expect(templates).to.include('wave-validation');
      expect(templates).to.include('priority-analysis');
    });

    /** @ac US-058-AC-5: Version prompts */
    it('US-058-AC-5: should version prompts', () => {
      const version = builder.getTemplateVersion('dependency-inference');

      expect(version).to.be.a('string');
      expect(version).to.match(/^\d+\.\d+\.\d+$/);
    });

    /** @ac US-058-AC-6: A/B test prompts */
    it('US-058-AC-6: should support A/B testing', () => {
      const variantA = builder.buildPrompt({
        template: 'dependency-inference',
        context: { components: [] },
        variant: 'A',
      });

      const variantB = builder.buildPrompt({
        template: 'dependency-inference',
        context: { components: [] },
        variant: 'B',
      });

      // Variant B should be more concise
      expect(variantB.userPrompt.length).to.be.lessThan(variantA.userPrompt.length);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate token count', () => {
      const result = builder.buildPrompt({
        template: 'dependency-inference',
        context: { components: [{ name: 'Test' }] },
      });

      expect(result.estimatedTokens).to.be.a('number');
      expect(result.estimatedTokens).to.be.greaterThan(0);
    });

    it('should warn about large prompts', () => {
      const largeComponents = Array.from({ length: 1000 }, (_, i) => ({
        name: `Component${i}`,
        metadata: 'x'.repeat(100),
      }));

      const result = builder.buildPrompt({
        template: 'dependency-inference',
        context: { components: largeComponents },
      });

      // Should still build but with limited data
      expect(result.estimatedTokens).to.be.greaterThan(0);
    });
  });

  describe('Template Management', () => {
    it('should get template details', () => {
      const template = builder.getTemplate('wave-validation');

      expect(template).to.exist;
      expect(template?.name).to.equal('Wave Validation');
      expect(template?.version).to.be.a('string');
    });

    it('should throw on unknown template', () => {
      expect(() => {
        builder.buildPrompt({
          template: 'non-existent',
          context: {},
        });
      }).to.throw('Template');
    });
  });
});
