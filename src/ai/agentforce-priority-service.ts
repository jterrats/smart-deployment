/**
 * Agentforce Priority Service - US-057
 * Uses Salesforce AI to suggest component deployment priorities
 *
 * @ac US-057-AC-1: Send component list to Agentforce
 * @ac US-057-AC-2: Receive priority recommendations
 * @ac US-057-AC-3: Consider business criticality
 * @ac US-057-AC-4: Consider failure impact
 * @ac US-057-AC-5: Merge with static priorities
 * @ac US-057-AC-6: Report AI decisions
 * @issue #57
 */

import { getLogger } from '../utils/logger.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { AgentforceFetch } from './agentforce-service.js';
import { createLLMProvider } from './llm-provider-factory.js';
import type { LLMProvider, LLMProviderName } from './llm-provider.js';

const logger = getLogger('AgentforcePriorityService');

export type PriorityRecommendation = {
  componentName: string;
  priority: number;
  reason: string;
  confidence: number;
  businessCriticality: 'low' | 'medium' | 'high' | 'critical';
  failureImpact: 'low' | 'medium' | 'high' | 'critical';
};

export type AgentforceConfig = {
  baseDir?: string;
  provider?: LLMProviderName;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  enabled?: boolean;
  maxRetries?: number;
  rateLimit?: number;
  fetchFn?: AgentforceFetch;
  llmProvider?: LLMProvider;
};

export type PriorityAnalysisResult = {
  recommendations: PriorityRecommendation[];
  totalComponents: number;
  aiAdjustments: number;
  executionTime: number;
  tokensUsed?: number;
  usedFallback: boolean;
};

/**
 * @ac US-057-AC-1: Send component list to Agentforce
 * @ac US-057-AC-2: Receive priority recommendations
 */
export class AgentforcePriorityService {
  private readonly llmProvider: LLMProvider;
  private readonly enabled: boolean;

  public constructor(config: AgentforceConfig = {}) {
    this.llmProvider =
      config.llmProvider ??
      createLLMProvider({
        baseDir: config.baseDir,
        provider: config.provider,
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
        enabled: config.enabled,
        rateLimit: config.rateLimit,
        fetchFn: config.fetchFn,
      });
    this.enabled = this.llmProvider.isEnabled();
  }

  /**
   * @ac US-057-AC-1: Send component list to Agentforce
   * @ac US-057-AC-2: Receive priority recommendations
   * @ac US-057-AC-3: Consider business criticality
   * @ac US-057-AC-4: Consider failure impact
   */
  public async analyzePriorities(
    components: MetadataComponent[],
    context?: { orgType?: string; industry?: string }
  ): Promise<PriorityAnalysisResult> {
    const startTime = Date.now();
    const prompt = this.buildPriorityPrompt(components, context);

    if (!this.enabled) {
      logger.info('Agentforce disabled, returning empty recommendations');
      return {
        recommendations: [],
        totalComponents: components.length,
        aiAdjustments: 0,
        executionTime: 0,
        usedFallback: false,
      };
    }

    logger.info('Analyzing component priorities with Agentforce', {
      componentCount: components.length,
      orgType: context?.orgType,
      industry: context?.industry,
    });

    try {
      const response = await this.llmProvider.sendRequest({
        model: this.llmProvider.getConfig().model,
        prompt,
        temperature: 0.2,
        maxTokens: 4000,
      });

      const recommendations = this.parseResponse(response.content);

      const executionTime = Date.now() - startTime;

      logger.info('Priority analysis complete', {
        recommendations: recommendations.length,
        executionTime,
      });

      return {
        recommendations,
        totalComponents: components.length,
        aiAdjustments: recommendations.filter((r) => r.confidence > 0.8).length,
        executionTime,
        tokensUsed: response.tokensUsed,
        usedFallback: false,
      };
    } catch (error) {
      logger.warn('LLM priority analysis failed, falling back to static recommendations', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.llmProvider.getConfig().provider,
      });
      return this.createFallbackResult(components, prompt, startTime);
    }
  }

  /**
   * @ac US-057-AC-3: Consider business criticality
   * @ac US-057-AC-4: Consider failure impact
   */
  private buildPriorityPrompt(
    components: MetadataComponent[],
    context?: { orgType?: string; industry?: string }
  ): string {
    const componentList = components.map((c) => `- ${c.type}: ${c.name}`).join('\n');

    const contextInfo = context
      ? `\nOrg Type: ${context.orgType ?? 'Unknown'}\nIndustry: ${context.industry ?? 'Unknown'}`
      : '';

    return `You are an expert Salesforce deployment analyst. Analyze these components and suggest deployment priorities.

Context:${contextInfo}

Components to analyze:
${componentList}

For each component, consider:
1. **Business Criticality**: How important is this to business operations?
2. **Failure Impact**: What happens if this component fails to deploy?
3. **Dependencies**: Should this deploy before or after others?
4. **Risk Level**: How risky is deploying this component?

Assign priorities (0-100):
- 90-100: CRITICAL (payment processing, authentication, core business logic)
- 70-89: HIGH (important features, customer-facing)
- 40-69: MEDIUM (supporting features, utilities)
- 0-39: LOW (logging, monitoring, non-critical utilities)

Respond ONLY with valid JSON (no markdown):
{
  "recommendations": [
    {
      "componentName": "exact component name",
      "priority": 85,
      "reason": "brief explanation",
      "confidence": 0.9,
      "businessCriticality": "high",
      "failureImpact": "high"
    }
  ]
}`;
  }

  /**
   * @ac US-057-AC-1: Send component list to Agentforce
   */
  private parseResponse(content: string): PriorityRecommendation[] {
    try {
      // Remove markdown code blocks if present
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanContent) as { recommendations: PriorityRecommendation[] };

      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        logger.warn('Invalid response format, returning empty recommendations');
        return [];
      }

      return parsed.recommendations;
    } catch (error) {
      logger.error('Failed to parse Agentforce response', { error });
      return [];
    }
  }

  /**
   * Mock response for testing and fallback
   */
  private getMockResponse(prompt: string): AgentforceResponse {
    // Extract component names from prompt
    const componentMatches = prompt.matchAll(/- (\w+): ([\w_]+)/g);
    const recommendations: PriorityRecommendation[] = [];

    for (const match of componentMatches) {
      const type = match[1];
      const name = match[2];

      // Simple heuristic-based mock priorities
      let priority = 50;
      let businessCriticality: PriorityRecommendation['businessCriticality'] = 'medium';
      let failureImpact: PriorityRecommendation['failureImpact'] = 'medium';

      if (name.toLowerCase().includes('payment') || name.toLowerCase().includes('auth')) {
        priority = 95;
        businessCriticality = 'critical';
        failureImpact = 'critical';
      } else if (name.toLowerCase().includes('handler') || name.toLowerCase().includes('service')) {
        priority = 75;
        businessCriticality = 'high';
        failureImpact = 'high';
      } else if (name.toLowerCase().includes('log') || name.toLowerCase().includes('audit')) {
        priority = 20;
        businessCriticality = 'low';
        failureImpact = 'low';
      }

      recommendations.push({
        componentName: name,
        priority,
        reason: `Mock: ${type} with ${businessCriticality} business impact`,
        confidence: 0.85,
        businessCriticality,
        failureImpact,
      });
    }

    return {
      choices: [
        {
          message: {
            content: JSON.stringify({ recommendations }),
          },
        },
      ],
      usage: {
        total_tokens: 500,
      },
    };
  }

  private createFallbackResult(
    components: MetadataComponent[],
    prompt: string,
    startTime: number
  ): PriorityAnalysisResult {
    const response = this.getMockResponse(prompt);
    const content = response.choices?.[0]?.message?.content ?? '{}';
    const recommendations = this.parseResponse(content);

    return {
      recommendations,
      totalComponents: components.length,
      aiAdjustments: recommendations.filter((recommendation) => recommendation.confidence > 0.8).length,
      executionTime: Date.now() - startTime,
      tokensUsed: response.usage?.['total_tokens'],
      usedFallback: true,
    };
  }

  /**
   * @ac US-057-AC-6: Report AI decisions
   */
  public formatDecisionReport(result: PriorityAnalysisResult): string {
    const lines: string[] = [];

    lines.push('🤖 AI Priority Analysis Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Total Components: ${result.totalComponents}`);
    lines.push(`AI Adjustments: ${result.aiAdjustments}`);
    lines.push(`Execution Time: ${result.executionTime}ms`);
    if (result.tokensUsed) {
      lines.push(`Tokens Used: ${result.tokensUsed}`);
    }
    lines.push('');

    if (result.recommendations.length > 0) {
      lines.push('Priority Recommendations:');
      const sorted = result.recommendations.sort((a, b) => b.priority - a.priority);

      for (const rec of sorted.slice(0, 10)) {
        // Top 10
        lines.push(
          `  ${rec.priority.toString().padStart(3)} | ${rec.componentName.padEnd(
            30
          )} | ${rec.businessCriticality.toUpperCase()}`
        );
        lines.push(`      ${rec.reason}`);
      }

      if (result.recommendations.length > 10) {
        lines.push(`  ... and ${result.recommendations.length - 10} more`);
      }
    } else {
      lines.push('No AI recommendations (using static priorities)');
    }

    return lines.join('\n');
  }

  public getProviderConfig(): Readonly<ReturnType<LLMProvider['getConfig']>> {
    return this.llmProvider.getConfig();
  }
}

// Internal types
type AgentforceResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
};
