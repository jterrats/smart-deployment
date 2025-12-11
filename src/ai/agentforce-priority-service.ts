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

const logger = getLogger('AgentforcePriorityService');

export interface PriorityRecommendation {
  componentName: string;
  priority: number;
  reason: string;
  confidence: number;
  businessCriticality: 'low' | 'medium' | 'high' | 'critical';
  failureImpact: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentforceConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  enabled?: boolean;
  autoApply?: boolean; // Auto-apply recommendations with high confidence
  confidenceThreshold?: number; // Minimum confidence to auto-apply (default: 0.8)
}

export interface PriorityAnalysisResult {
  recommendations: PriorityRecommendation[];
  totalComponents: number;
  aiAdjustments: number;
  executionTime: number;
  tokensUsed?: number;
}

/**
 * @ac US-057-AC-1: Send component list to Agentforce
 * @ac US-057-AC-2: Receive priority recommendations
 */
export class AgentforcePriorityService {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeout: number;
  private readonly enabled: boolean;
  private readonly autoApply: boolean;
  private readonly confidenceThreshold: number;

  constructor(private config: AgentforceConfig = {}) {
    this.endpoint = config.endpoint || 'https://api.salesforce.com/services/einstein/llm/v1';
    this.model = config.model || 'claude-sonnet';
    this.timeout = config.timeout || 30000;
    this.enabled = config.enabled ?? true;
    this.autoApply = config.autoApply ?? false;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.8;
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

    if (!this.enabled) {
      logger.info('Agentforce disabled, returning empty recommendations');
      return {
        recommendations: [],
        totalComponents: components.length,
        aiAdjustments: 0,
        executionTime: 0,
      };
    }

    logger.info('Analyzing component priorities with Agentforce', {
      componentCount: components.length,
      orgType: context?.orgType,
      industry: context?.industry,
    });

    try {
      // Build prompt with business context
      const prompt = this.buildPriorityPrompt(components, context);

      // Call Agentforce API
      const response = await this.callAgentforce(prompt);

      // Parse recommendations
      const recommendations = this.parseResponse(response);

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
        tokensUsed: response.usage?.total_tokens,
      };
    } catch (error) {
      logger.error('Agentforce analysis failed, falling back to static', { error });
      return {
        recommendations: [],
        totalComponents: components.length,
        aiAdjustments: 0,
        executionTime: Date.now() - startTime,
      };
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
      ? `\nOrg Type: ${context.orgType || 'Unknown'}\nIndustry: ${context.industry || 'Unknown'}`
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
  private async callAgentforce(prompt: string): Promise<AgentforceResponse> {
    logger.debug('Calling Agentforce API');

    // Mock response for testing (when no API key)
    if (!this.config.apiKey) {
      logger.warn('No API key configured, using mock response');
      return this.getMockResponse(prompt);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert Salesforce deployment analyst. Respond only with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2, // Low for consistent recommendations
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Agentforce API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as AgentforceResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Agentforce request timed out');
      }
      throw error;
    }
  }

  /**
   * @ac US-057-AC-2: Receive priority recommendations
   */
  private parseResponse(response: AgentforceResponse): PriorityRecommendation[] {
    try {
      const content = response.choices?.[0]?.message?.content || '{}';

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

  /**
   * @ac US-057-AC-6: Report AI decisions
   */
  public formatDecisionReport(result: PriorityAnalysisResult, autoApplied = false): string {
    const lines: string[] = [];

    lines.push('🤖 AI Priority Analysis Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Mode: ${autoApplied ? 'Auto-Apply' : 'Manual Review'}`);
    if (autoApplied) {
      lines.push(`Confidence Threshold: ${(this.confidenceThreshold * 100).toFixed(0)}%`);
    }
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

      // Separate by confidence
      const autoAppliedRecs = sorted.filter((r) => r.confidence > this.confidenceThreshold);
      const skippedRecs = sorted.filter((r) => r.confidence <= this.confidenceThreshold);

      if (autoApplied && autoAppliedRecs.length > 0) {
        lines.push(`\n✅ Auto-Applied (confidence > ${(this.confidenceThreshold * 100).toFixed(0)}%):`);
        for (const rec of autoAppliedRecs.slice(0, 10)) {
          lines.push(
            `  ${rec.priority.toString().padStart(3)} | ${rec.componentName.padEnd(
              30
            )} | ${rec.businessCriticality.toUpperCase()} (${(rec.confidence * 100).toFixed(0)}%)`
          );
          lines.push(`      ${rec.reason}`);
        }
      }

      if (skippedRecs.length > 0) {
        lines.push(`\n⏭️  Skipped (confidence ≤ ${(this.confidenceThreshold * 100).toFixed(0)}%):`);
        for (const rec of skippedRecs.slice(0, 5)) {
          lines.push(
            `  ${rec.priority.toString().padStart(3)} | ${rec.componentName.padEnd(
              30
            )} | ${rec.businessCriticality.toUpperCase()} (${(rec.confidence * 100).toFixed(0)}%)`
          );
        }
      }

      const totalShown = Math.min(10, autoAppliedRecs.length) + Math.min(5, skippedRecs.length);
      if (result.recommendations.length > totalShown) {
        lines.push(`\n  ... and ${result.recommendations.length - totalShown} more`);
      }
    } else {
      lines.push('No AI recommendations (using static priorities)');
    }

    if (autoApplied && result.recommendations.length > 0) {
      lines.push('\n💡 All high-confidence recommendations were applied automatically');
    } else if (!autoApplied) {
      lines.push('\n💡 Use --ai-auto to automatically apply high-confidence recommendations');
    }

    return lines.join('\n');
  }

  /**
   * Get auto-apply configuration
   */
  public getAutoApplyConfig(): { enabled: boolean; threshold: number } {
    return {
      enabled: this.autoApply,
      threshold: this.confidenceThreshold,
    };
  }
}

// Internal types
interface AgentforceResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
}
