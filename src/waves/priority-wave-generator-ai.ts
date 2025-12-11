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
import { DEPLOYMENT_ORDER } from '../constants/deployment-order.js';
import { PriorityWaveGenerator, type PriorityOptions } from './priority-wave-generator.js';
import type { AgentforcePriorityService, PriorityAnalysisResult } from '../ai/agentforce-priority-service.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from './wave-builder.js';

const logger = getLogger('AIEnhancedPriorityWaveGenerator');

export interface AIEnhancedOptions extends PriorityOptions {
  agentforceService?: AgentforcePriorityService;
  orgType?: string;
  industry?: string;
  autoAIForUnknown?: boolean; // Auto-enable AI for unknown types (default: true)
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
  private autoAIForUnknown: boolean;
  private unknownTypesDetected: Set<string> = new Set();

  public constructor(options: AIEnhancedOptions = {}) {
    super(options);
    this.agentforceService = options.agentforceService;
    this.orgType = options.orgType;
    this.industry = options.industry;
    this.autoAIForUnknown = options.autoAIForUnknown ?? true;
  }

  /**
   * @ac US-057-AC-5: Merge with static priorities
   * @ac US-042-AC-4: User-defined priority overrides
   */
  public async applyPriorityWavesAsync(
    waves: Wave[],
    components: Map<NodeId, MetadataComponent>
  ): Promise<Wave[]> {
    // Detect unknown metadata types
    const unknownComponents = this.detectUnknownTypes(components);

    if (unknownComponents.length > 0) {
      logger.warn('Unknown metadata types detected', {
        count: unknownComponents.length,
        types: Array.from(this.unknownTypesDetected),
      });

      // Auto-enable AI for unknown types if service available
      if (this.agentforceService && this.autoAIForUnknown) {
        logger.info('Auto-enabling AI analysis for unknown types');
      } else if (!this.agentforceService && unknownComponents.length > 0) {
        logger.warn('Unknown types found but no AI service configured', {
          types: Array.from(this.unknownTypesDetected),
          suggestion: 'Use --use-ai flag for intelligent prioritization',
        });
      }
    }

    // Get AI recommendations if available
    if (this.agentforceService) {
      const componentList = Array.from(components.values());

      // Prioritize unknown types in AI analysis
      const componentsToAnalyze = this.autoAIForUnknown && unknownComponents.length > 0
        ? unknownComponents // Focus on unknowns first
        : componentList;

      this.aiAnalysisResult = await this.agentforceService.analyzePriorities(componentsToAnalyze, {
        orgType: this.orgType,
        industry: this.industry,
      });

      logger.info('AI analysis complete', {
        adjustments: this.aiAnalysisResult.aiAdjustments,
        executionTime: this.aiAnalysisResult.executionTime,
        unknownTypesAnalyzed: unknownComponents.length,
      });

      // Merge AI recommendations into user priorities
      this.mergeAIPriorities(components);
    }

    // Use base class method with enhanced priorities
    return this.applyPriorityWaves(waves, components);
  }

  /**
   * Detect components with unknown metadata types (priority 99 or not in DEPLOYMENT_ORDER)
   */
  private detectUnknownTypes(components: Map<NodeId, MetadataComponent>): MetadataComponent[] {
    const unknownComponents: MetadataComponent[] = [];

    for (const component of components.values()) {
      const priority = DEPLOYMENT_ORDER[component.type];

      // Unknown if priority is 99 or not defined
      if (!priority || priority === 99) {
        this.unknownTypesDetected.add(component.type);
        unknownComponents.push(component);
      }
    }

    return unknownComponents;
  }

  /**
   * @ac US-057-AC-5: Merge with static priorities
   */
  private mergeAIPriorities(components: Map<NodeId, MetadataComponent>): void {
    if (!this.aiAnalysisResult || !this.agentforceService) return;

    // Get auto-apply configuration from service
    const { enabled: autoApply, threshold } = this.agentforceService.getAutoApplyConfig();

    if (!autoApply) {
      logger.info('AI auto-apply disabled, recommendations available for manual review');
      return;
    }

    // Access protected options from base class
    const baseOptions = (this as unknown as { options: PriorityOptions }).options;
    const userPriorities = baseOptions.userPriorities ?? new Map();

    let appliedCount = 0;
    let skippedCount = 0;

    for (const rec of this.aiAnalysisResult.recommendations) {
      // Find component by name
      const nodeId = Array.from(components.keys()).find((id) => id.endsWith(`:${rec.componentName}`));

      if (!nodeId) continue;

      // Check confidence threshold
      if (rec.confidence > threshold) {
        // Only apply if no user override exists
        if (!userPriorities.has(nodeId)) {
          userPriorities.set(nodeId, rec.priority);
          appliedCount++;
          logger.debug('Applied AI priority (auto)', {
            component: nodeId,
            priority: rec.priority,
            confidence: rec.confidence,
            reason: rec.reason,
          });
        }
      } else {
        skippedCount++;
        logger.debug('Skipped AI priority (low confidence)', {
          component: nodeId,
          confidence: rec.confidence,
          threshold,
        });
      }
    }

    logger.info('AI priorities merged', {
      applied: appliedCount,
      skipped: skippedCount,
      threshold,
    });
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
        unknownTypesDetected: number;
        unknownTypes: string[];
      }
    | undefined {
    if (!this.aiAnalysisResult) return undefined;

    return {
      aiAdjustments: this.aiAnalysisResult.aiAdjustments,
      aiExecutionTime: this.aiAnalysisResult.executionTime,
      tokensUsed: this.aiAnalysisResult.tokensUsed,
      unknownTypesDetected: this.unknownTypesDetected.size,
      unknownTypes: Array.from(this.unknownTypesDetected),
    };
  }

  /**
   * Get warning message if unknown types were detected without AI
   */
  public getUnknownTypesWarning(): string | undefined {
    if (this.unknownTypesDetected.size === 0) {
      return undefined;
    }

    if (!this.agentforceService) {
      return `⚠️  Found ${this.unknownTypesDetected.size} unknown metadata type(s): ${Array.from(this.unknownTypesDetected).join(', ')}\n💡 Tip: Use --use-ai for intelligent prioritization of unknown types`;
    }

    return undefined;
  }
}

