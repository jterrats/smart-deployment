/**
 * AI-Enhanced Priority Wave Generator - US-042 + US-057
 * Extends priority wave generation with Agentforce AI
 * 
 * @ac US-042-AC-1: Use deployment order constants
 * @ac US-042-AC-2: Objects before classes before triggers
 * @ac US-042-AC-3: Break ties using priorities
 * @ac US-042-AC-4: User-defined priority overrides
 * @ac US-042-AC-5: Report priority decisions
 * @ac US-042-AC-6: Validate no dependency violations
 * @ac US-057-AC-5: Merge with static priorities
 * @ac US-057-AC-6: Report AI decisions
 * 
 * @issue #42, #57
 */

import { getLogger } from '../utils/logger.js';
import { PriorityWaveGenerator, type PriorityOptions } from './priority-wave-generator.js';
import type { AgentforcePriorityService, PriorityAnalysisResult } from '../ai/agentforce-priority-service.js';
import type { NodeId, DependencyGraph } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from './wave-builder.js';

const logger = getLogger('AIEnhancedPriorityWaveGenerator');

export interface AIEnhancedOptions extends PriorityOptions {
  agentforceService?: AgentforcePriorityService;
  orgType?: string;
  industry?: string;
}

/**
 * AI-Enhanced Priority Wave Generator
 * 
 * Combines static priority rules with AI-powered recommendations
 * for intelligent deployment ordering.
 * 
 * @example
 * const aiService = new AgentforcePriorityService({ apiKey: 'xxx' });
 * const generator = new AIEnhancedPriorityWaveGenerator({
 *   agentforceService: aiService,
 *   orgType: 'Production',
 *   industry: 'Fintech'
 * });
 * 
 * const waves = await generator.applyPriorityWavesAsync(baseWaves, components);
 */
export class AIEnhancedPriorityWaveGenerator extends PriorityWaveGenerator {
  private agentforceService?: AgentforcePriorityService;
  private aiAnalysisResult?: PriorityAnalysisResult;
  private orgType?: string;
  private industry?: string;

  public constructor(options: AIEnhancedOptions = {}) {
    super(options);
    this.agentforceService = options.agentforceService;
    this.orgType = options.orgType;
    this.industry = options.industry;
  }

  /**
   * @ac US-057-AC-5: Merge with static priorities
   * @ac US-042-AC-4: User-defined priority overrides
   */
  public async applyPriorityWavesAsync(
    waves: Wave[],
    components: Map<NodeId, MetadataComponent>
  ): Promise<Wave[]> {
    // Get AI recommendations if available
    if (this.agentforceService) {
      const componentList = Array.from(components.values());
      this.aiAnalysisResult = await this.agentforceService.analyzePriorities(componentList, {
        orgType: this.orgType,
        industry: this.industry,
      });

      logger.info('AI analysis complete', {
        adjustments: this.aiAnalysisResult.aiAdjustments,
        executionTime: this.aiAnalysisResult.executionTime,
      });

      // Merge AI recommendations into user priorities
      this.mergeAIPriorities(components);
    }

    // Use base class method with enhanced priorities
    return this.applyPriorityWaves(waves, components);
  }

  /**
   * @ac US-057-AC-5: Merge with static priorities
   */
  private mergeAIPriorities(components: Map<NodeId, MetadataComponent>): void {
    if (!this.aiAnalysisResult) return;

    const userPriorities = (this as { options: { userPriorities: Map<NodeId, number> } }).options.userPriorities;

    for (const rec of this.aiAnalysisResult.recommendations) {
      // Find component by name
      const nodeId = Array.from(components.keys()).find((id) => id.endsWith(`:${rec.componentName}`));

      if (nodeId && rec.confidence > 0.8) {
        // Only apply if no user override exists
        if (!userPriorities.has(nodeId)) {
          userPriorities.set(nodeId, rec.priority);
          logger.debug('Applied AI priority', {
            component: nodeId,
            priority: rec.priority,
            reason: rec.reason,
          });
        }
      }
    }
  }

  /**
   * @ac US-057-AC-6: Report AI decisions
   */
  public getAIReport(): string | undefined {
    if (!this.aiAnalysisResult || !this.agentforceService) {
      return undefined;
    }
    return this.agentforceService.formatDecisionReport(this.aiAnalysisResult);
  }

  /**
   * @ac US-057-AC-6: Report AI decisions
   */
  public getAIStats():
    | {
        aiAdjustments: number;
        aiExecutionTime: number;
        tokensUsed?: number;
      }
    | undefined {
    if (!this.aiAnalysisResult) return undefined;

    return {
      aiAdjustments: this.aiAnalysisResult.aiAdjustments,
      aiExecutionTime: this.aiAnalysisResult.executionTime,
      tokensUsed: this.aiAnalysisResult.tokensUsed,
    };
  }
}

