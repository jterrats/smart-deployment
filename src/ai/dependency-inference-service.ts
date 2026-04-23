/**
 * AI Dependency Inference Service - US-055
 * Uses Agentforce to infer non-obvious dependencies
 *
 * @ac US-055-AC-1: Send component context to Agentforce
 * @ac US-055-AC-2: Receive dependency inferences
 * @ac US-055-AC-3: Parse AI responses
 * @ac US-055-AC-4: Confidence scoring
 * @ac US-055-AC-5: Fallback to static analysis if AI fails
 * @ac US-055-AC-6: Cache AI results
 * @issue #55
 */

import { getLogger } from '../utils/logger.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { DependencyGraph } from '../types/dependency.js';
import type { LLMProvider } from './llm-provider.js';
import { createLLMProvider } from './llm-provider-factory.js';

const logger = getLogger('DependencyInferenceService');

export interface InferredDependency {
  from: string;
  to: string;
  type: 'implicit' | 'dynamic' | 'runtime' | 'business-logic';
  confidence: number;
  reason: string;
  lineNumber?: number;
}

export interface InferenceResult {
  dependencies: InferredDependency[];
  totalInferred: number;
  highConfidenceCount: number;
  executionTime: number;
  usedCache: boolean;
  fallbackToStatic: boolean;
}

export interface DependencyInferenceServiceOptions {
  baseDir?: string;
}

/**
 * @ac US-055-AC-1: Send component context to Agentforce
 * @ac US-055-AC-2: Receive dependency inferences
 */
export class DependencyInferenceService {
  private readonly llmProvider: LLMProvider;
  private readonly cache: Map<string, InferredDependency[]> = new Map();
  private readonly confidenceThreshold: number;

  public constructor(
    llmProviderOrOptions?: LLMProvider | DependencyInferenceServiceOptions,
    confidenceThreshold: number = 0.7
  ) {
    this.llmProvider = this.resolveProvider(llmProviderOrOptions);
    this.confidenceThreshold = confidenceThreshold;

    logger.info('Dependency inference service initialized', {
      confidenceThreshold,
      agentforceEnabled: this.llmProvider.isEnabled(),
    });
  }

  private resolveProvider(llmProviderOrOptions?: LLMProvider | DependencyInferenceServiceOptions): LLMProvider {
    if (llmProviderOrOptions && 'sendRequest' in llmProviderOrOptions) {
      return llmProviderOrOptions;
    }

    return createLLMProvider({
      baseDir: llmProviderOrOptions?.baseDir,
    });
  }

  /**
   * @ac US-055-AC-1: Send component context to Agentforce
   * Infer dependencies for components
   */
  public async inferDependencies(
    components: MetadataComponent[],
    existingGraph?: DependencyGraph
  ): Promise<InferenceResult> {
    const startTime = Date.now();

    const result: InferenceResult = {
      dependencies: [],
      totalInferred: 0,
      highConfidenceCount: 0,
      executionTime: 0,
      usedCache: false,
      fallbackToStatic: false,
    };

    try {
      // Check if Agentforce is enabled
      if (!this.llmProvider.isEnabled()) {
        logger.info('Agentforce disabled, skipping inference');
        result.fallbackToStatic = true;
        return result;
      }

      // Build prompt with component context
      const prompt = this.buildInferencePrompt(components, existingGraph);

      // Check cache first
      const cacheKey = this.getCacheKey(components);
      if (this.cache.has(cacheKey)) {
        logger.debug('Using cached inference result');
        result.dependencies = this.cache.get(cacheKey)!;
        result.usedCache = true;
        result.totalInferred = result.dependencies.length;
        result.highConfidenceCount = result.dependencies.filter((d) => d.confidence >= this.confidenceThreshold).length;
        result.executionTime = Date.now() - startTime;
        return result;
      }

      // Send to Agentforce
      const response = await this.llmProvider.sendRequest({
        model: this.llmProvider.getConfig().model,
        prompt,
        temperature: 0.2, // Lower temperature for more consistent results
        maxTokens: 2000,
      });

      // Parse response
      const inferredDeps = this.parseInferenceResponse(response.content);

      // Filter by confidence
      const highConfidenceDeps = inferredDeps.filter((d) => d.confidence >= this.confidenceThreshold);

      result.dependencies = highConfidenceDeps;
      result.totalInferred = inferredDeps.length;
      result.highConfidenceCount = highConfidenceDeps.length;
      result.executionTime = Date.now() - startTime;

      // Cache result
      this.cache.set(cacheKey, highConfidenceDeps);

      logger.info('Dependency inference completed', {
        total: result.totalInferred,
        highConfidence: result.highConfidenceCount,
        executionTime: result.executionTime,
      });

      return result;
    } catch (error) {
      logger.error('Dependency inference failed, falling back to static analysis', {
        error: error instanceof Error ? error.message : String(error),
      });

      result.fallbackToStatic = true;
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Build prompt for dependency inference
   */
  private buildInferencePrompt(components: MetadataComponent[], existingGraph?: DependencyGraph): string {
    const componentSummaries = components.slice(0, 20).map((c) => ({
      name: c.name,
      type: c.type,
      dependencies: Array.from(c.dependencies),
    }));

    const prompt = `You are an expert Salesforce metadata analyzer. Analyze the following components and infer any non-obvious dependencies that are not captured by static analysis.

Look for:
1. Dynamic references (e.g., Type.forName(), Schema.getGlobalDescribe())
2. Implicit dependencies (e.g., sharing rules, field dependencies)
3. Runtime dependencies (e.g., custom settings, platform events)
4. Business logic dependencies (e.g., workflows triggering other workflows)

Components:
${JSON.stringify(componentSummaries, null, 2)}

${existingGraph ? `\nExisting dependencies:\n${JSON.stringify(existingGraph, null, 2)}` : ''}

Return ONLY a JSON array of inferred dependencies in this format:
[
  {
    "from": "ComponentA",
    "to": "ComponentB",
    "type": "implicit|dynamic|runtime|business-logic",
    "confidence": 0.0-1.0,
    "reason": "Brief explanation",
    "lineNumber": 123
  }
]

Only include dependencies with confidence > 0.5. Be conservative - it's better to miss a dependency than to create a false positive.`;

    return prompt;
  }

  /**
   * @ac US-055-AC-3: Parse AI responses
   * Parse Agentforce response into structured data
   */
  private parseInferenceResponse(content: string): InferredDependency[] {
    try {
      // Extract JSON from response (may have surrounding text)
      const jsonMatch = /\[[\s\S]*?\]/.exec(content);
      if (!jsonMatch) {
        logger.warn('No JSON array found in response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown[];

      // Validate and map to InferredDependency
      const dependencies: InferredDependency[] = [];

      for (const item of parsed) {
        if (
          typeof item === 'object' &&
          item !== null &&
          'from' in item &&
          'to' in item &&
          'type' in item &&
          'confidence' in item &&
          'reason' in item
        ) {
          const dep = item as Record<string, unknown>;
          dependencies.push({
            from: String(dep.from),
            to: String(dep.to),
            type: String(dep.type) as InferredDependency['type'],
            confidence: Number(dep.confidence),
            reason: String(dep.reason),
            lineNumber: dep.lineNumber ? Number(dep.lineNumber) : undefined,
          });
        }
      }

      return dependencies;
    } catch (error) {
      logger.error('Failed to parse inference response', {
        error: error instanceof Error ? error.message : String(error),
        content: content.slice(0, 200),
      });
      return [];
    }
  }

  /**
   * @ac US-055-AC-6: Cache AI results
   * Generate cache key for components
   */
  private getCacheKey(components: MetadataComponent[]): string {
    // Create deterministic key from component names and types
    const sortedComponents = components
      .map((c) => `${c.type}:${c.name}`)
      .sort()
      .join('|');

    return `inference:${sortedComponents}`;
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    logger.debug('Inference cache cleared');
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get confidence threshold
   */
  public getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }
}
