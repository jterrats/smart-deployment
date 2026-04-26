/**
 * AI Wave Validation Service - US-056
 * Uses Agentforce to validate deployment waves for business logic issues
 *
 * @ac US-056-AC-1: Send wave structure to Agentforce
 * @ac US-056-AC-2: Receive validation feedback
 * @ac US-056-AC-3: Identify potential issues
 * @ac US-056-AC-4: Suggest optimizations
 * @ac US-056-AC-5: Risk assessment per wave
 * @ac US-056-AC-6: Apply AI suggestions (optional)
 * @issue #56
 */

import { getLogger } from '../utils/logger.js';
import type { Wave } from '../waves/wave-builder.js';
import type { LLMProvider } from './llm-provider.js';
import { createLLMProvider } from './llm-provider-factory.js';

const logger = getLogger('WaveValidationService');

type WaveValidationPayload = {
  issues: WaveValidationIssue[];
  optimizations: WaveOptimization[];
  riskAssessments: WaveRiskAssessment[];
};

type PromptWaveSummary = {
  number: number;
  componentCount: number;
  types: Wave['metadata']['types'];
  components: string[];
};

export type WaveValidationIssue = {
  waveNumber: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'dependency' | 'business-logic' | 'performance' | 'risk';
  message: string;
  affectedComponents: string[];
  suggestion?: string;
};

export type WaveOptimization = {
  waveNumber: number;
  type: 'merge' | 'split' | 'reorder' | 'add-component' | 'remove-component';
  description: string;
  confidence: number;
  estimatedImprovement: string;
};

export type WaveRiskAssessment = {
  waveNumber: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  mitigation: string[];
  recommendedActions: string[];
};

export type WaveValidationResult = {
  isValid: boolean;
  issues: WaveValidationIssue[];
  optimizations: WaveOptimization[];
  riskAssessments: WaveRiskAssessment[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  executionTime: number;
  aiAnalyzed: boolean;
};

export type WaveValidationServiceOptions = {
  baseDir?: string;
};

/**
 * @ac US-056-AC-1: Send wave structure to Agentforce
 * @ac US-056-AC-2: Receive validation feedback
 */
export class WaveValidationService {
  private readonly llmProvider: LLMProvider;

  public constructor(llmProviderOrOptions?: LLMProvider | WaveValidationServiceOptions) {
    this.llmProvider = this.resolveProvider(llmProviderOrOptions);
    logger.info('Wave validation service initialized');
  }

  private resolveProvider(llmProviderOrOptions?: LLMProvider | WaveValidationServiceOptions): LLMProvider {
    if (llmProviderOrOptions && 'sendRequest' in llmProviderOrOptions) {
      return llmProviderOrOptions;
    }

    return createLLMProvider({
      baseDir: llmProviderOrOptions?.baseDir,
    });
  }

  /**
   * @ac US-056-AC-1: Send wave structure to Agentforce
   * Validate deployment waves using AI
   */
  public async validateWaves(waves: Wave[]): Promise<WaveValidationResult> {
    const startTime = Date.now();
    const result = this.createDefaultResult();

    try {
      if (!this.llmProvider.isEnabled()) {
        logger.info('Agentforce disabled, skipping AI validation');
        return result;
      }

      const validation = await this.runAIValidation(waves);
      const evaluated = this.evaluateValidationPayload(validation);
      result.issues = evaluated.issues;
      result.optimizations = evaluated.optimizations;
      result.riskAssessments = evaluated.riskAssessments;
      result.overallRisk = evaluated.overallRisk;
      result.isValid = evaluated.isValid;
      result.aiAnalyzed = true;
      result.executionTime = this.calculateExecutionTime(startTime);

      logger.info('Wave validation completed', {
        waves: waves.length,
        issues: result.issues.length,
        optimizations: result.optimizations.length,
        overallRisk: result.overallRisk,
      });

      return result;
    } catch (error) {
      logger.error('Wave validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      result.executionTime = this.calculateExecutionTime(startTime);
      return result;
    }
  }

  private createDefaultResult(): WaveValidationResult {
    return {
      isValid: true,
      issues: [],
      optimizations: [],
      riskAssessments: [],
      overallRisk: 'low',
      executionTime: 0,
      aiAnalyzed: false,
    };
  }

  private calculateExecutionTime(startTime: number): number {
    return Date.now() - startTime;
  }

  private async runAIValidation(waves: Wave[]): Promise<WaveValidationPayload> {
    const response = await this.sendValidationRequest(waves);
    return this.parseValidationResponse(response.content, waves);
  }

  private async sendValidationRequest(waves: Wave[]): Promise<{ content: string }> {
    const prompt = this.buildValidationPrompt(waves);

    return this.llmProvider.sendRequest({
      model: this.llmProvider.getConfig().model,
      prompt,
      temperature: 0.1,
      maxTokens: 3000,
    });
  }

  private evaluateValidationPayload(validation: WaveValidationPayload): WaveValidationResult {
    return {
      isValid: !validation.issues.some((issue) => issue.severity === 'critical'),
      issues: validation.issues,
      optimizations: validation.optimizations,
      riskAssessments: validation.riskAssessments,
      overallRisk: this.calculateOverallRisk(validation.riskAssessments),
      executionTime: 0,
      aiAnalyzed: false,
    };
  }

  /**
   * Build validation prompt
   */
  private buildValidationPrompt(waves: Wave[]): string {
    const waveSummaries = this.summarizeWavesForPrompt(waves);

    return `You are an expert Salesforce deployment architect. Analyze the following deployment waves and identify potential issues.

Focus on:
1. **Business Logic Issues**: Components that should/shouldn't be in same wave
2. **Risk Assessment**: High-risk combinations
3. **Performance**: Wave size and deployment time concerns
4. **Dependencies**: Missing or incorrect ordering

Waves:
${JSON.stringify(waveSummaries, null, 2)}

Return ONLY a JSON object in this format:
{
  "issues": [
    {
      "waveNumber": 1,
      "severity": "low|medium|high|critical",
      "category": "dependency|business-logic|performance|risk",
      "message": "Description of issue",
      "affectedComponents": ["Component1", "Component2"],
      "suggestion": "How to fix"
    }
  ],
  "optimizations": [
    {
      "waveNumber": 1,
      "type": "merge|split|reorder",
      "description": "What to optimize",
      "confidence": 0.0-1.0,
      "estimatedImprovement": "10% faster deployment"
    }
  ],
  "riskAssessments": [
    {
      "waveNumber": 1,
      "riskLevel": "low|medium|high|critical",
      "riskFactors": ["Large wave size", "Complex dependencies"],
      "mitigation": ["Split into 2 waves", "Add validation tests"],
      "recommendedActions": ["Review before production deploy"]
    }
  ]
}

Be conservative - only report issues with high confidence.`;
  }

  private summarizeWavesForPrompt(waves: Wave[]): PromptWaveSummary[] {
    return waves.map((w) => ({
      number: w.number,
      componentCount: w.metadata.componentCount,
      types: w.metadata.types,
      components: w.components.slice(0, 20),
    }));
  }

  /**
   * @ac US-056-AC-2: Receive validation feedback
   * @ac US-056-AC-3: Identify potential issues
   * @ac US-056-AC-4: Suggest optimizations
   * @ac US-056-AC-5: Risk assessment per wave
   */
  private parseValidationResponse(content: string, waves: Wave[]): WaveValidationPayload {
    try {
      const parsed = this.extractValidationJson(content);
      if (!parsed) {
        logger.warn('No JSON found in validation response');
        return this.getMockValidation(waves);
      }

      return this.normalizeValidationPayload(parsed);
    } catch (error) {
      logger.error('Failed to parse validation response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getMockValidation(waves);
    }
  }

  private extractValidationJson(content: string): {
    issues?: unknown[];
    optimizations?: unknown[];
    riskAssessments?: unknown[];
  } | null {
    const jsonMatch = /\{[\s\S]*\}/.exec(content);
    if (!jsonMatch) {
      return null;
    }

    return JSON.parse(jsonMatch[0]) as {
      issues?: unknown[];
      optimizations?: unknown[];
      riskAssessments?: unknown[];
    };
  }

  private normalizeValidationPayload(parsed: {
    issues?: unknown[];
    optimizations?: unknown[];
    riskAssessments?: unknown[];
  }): WaveValidationPayload {
    return {
      issues: this.parseIssues(parsed.issues ?? []),
      optimizations: this.parseOptimizations(parsed.optimizations ?? []),
      riskAssessments: this.parseRiskAssessments(parsed.riskAssessments ?? []),
    };
  }

  /**
   * Parse issues from AI response
   */
  private parseIssues(items: unknown[]): WaveValidationIssue[] {
    const issues: WaveValidationIssue[] = [];

    for (const item of items) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'waveNumber' in item &&
        'severity' in item &&
        'category' in item &&
        'message' in item
      ) {
        const issue = item as Record<string, unknown>;
        issues.push({
          waveNumber: Number(issue.waveNumber),
          severity: String(issue.severity) as WaveValidationIssue['severity'],
          category: String(issue.category) as WaveValidationIssue['category'],
          message: String(issue.message),
          affectedComponents: Array.isArray(issue.affectedComponents) ? issue.affectedComponents.map(String) : [],
          suggestion: issue.suggestion ? String(issue.suggestion) : undefined,
        });
      }
    }

    return issues;
  }

  /**
   * Parse optimizations from AI response
   */
  private parseOptimizations(items: unknown[]): WaveOptimization[] {
    const optimizations: WaveOptimization[] = [];

    for (const item of items) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'waveNumber' in item &&
        'type' in item &&
        'description' in item
      ) {
        const opt = item as Record<string, unknown>;
        optimizations.push({
          waveNumber: Number(opt.waveNumber),
          type: String(opt.type) as WaveOptimization['type'],
          description: String(opt.description),
          confidence: Number(opt.confidence) || 0.5,
          estimatedImprovement: String(opt.estimatedImprovement) || 'Unknown',
        });
      }
    }

    return optimizations;
  }

  /**
   * Parse risk assessments from AI response
   */
  private parseRiskAssessments(items: unknown[]): WaveRiskAssessment[] {
    const assessments: WaveRiskAssessment[] = [];

    for (const item of items) {
      if (typeof item === 'object' && item !== null && 'waveNumber' in item && 'riskLevel' in item) {
        const risk = item as Record<string, unknown>;
        assessments.push({
          waveNumber: Number(risk.waveNumber),
          riskLevel: String(risk.riskLevel) as WaveRiskAssessment['riskLevel'],
          riskFactors: Array.isArray(risk.riskFactors) ? risk.riskFactors.map(String) : [],
          mitigation: Array.isArray(risk.mitigation) ? risk.mitigation.map(String) : [],
          recommendedActions: Array.isArray(risk.recommendedActions) ? risk.recommendedActions.map(String) : [],
        });
      }
    }

    return assessments;
  }

  /**
   * Get mock validation (fallback when AI unavailable)
   */
  private getMockValidation(waves: Wave[]): WaveValidationPayload {
    const riskAssessments: WaveRiskAssessment[] = waves.map((wave) => ({
      waveNumber: wave.number,
      riskLevel: wave.metadata.componentCount > 200 ? 'high' : 'low',
      riskFactors: wave.metadata.componentCount > 200 ? ['Large wave size'] : [],
      mitigation: wave.metadata.componentCount > 200 ? ['Consider splitting wave'] : [],
      recommendedActions: [],
    }));

    return {
      issues: [],
      optimizations: [],
      riskAssessments,
    };
  }

  /**
   * Calculate overall risk from individual assessments
   */
  private calculateOverallRisk(assessments: WaveRiskAssessment[]): 'low' | 'medium' | 'high' | 'critical' {
    if (assessments.length === 0) return 'low';

    const riskScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const maxRisk = Math.max(...assessments.map((a) => riskScores[a.riskLevel]));

    if (maxRisk >= 4) return 'critical';
    if (maxRisk >= 3) return 'high';
    if (maxRisk >= 2) return 'medium';
    return 'low';
  }

  /**
   * @ac US-056-AC-6: Apply AI suggestions (optional)
   * Apply optimization suggestions to waves
   */
  public applyOptimizations(waves: Wave[], optimizations: WaveOptimization[]): Wave[] {
    // For now, just return original waves
    // Future: implement actual optimization application
    logger.info('Optimization application not yet implemented', {
      optimizations: optimizations.length,
    });

    return waves;
  }

  public getProviderConfig(): Readonly<ReturnType<LLMProvider['getConfig']>> {
    return this.llmProvider.getConfig();
  }

  /**
   * Format validation report
   */
  public formatValidationReport(result: WaveValidationResult): string {
    const lines: string[] = [];

    lines.push('🔍 AI Wave Validation Report');
    lines.push('═══════════════════════════════════════');

    if (!result.aiAnalyzed) {
      lines.push('⚠️  AI validation unavailable (using basic checks)');
      lines.push('');
    }

    lines.push(`Overall Risk: ${this.getRiskIcon(result.overallRisk)} ${result.overallRisk.toUpperCase()}`);
    lines.push(`Execution Time: ${result.executionTime}ms`);
    lines.push('');

    this.appendIssueSection(lines, result);
    this.appendOptimizationSection(lines, result);
    this.appendRiskAssessmentSection(lines, result);

    return lines.join('\n');
  }

  private appendIssueSection(lines: string[], result: WaveValidationResult): void {
    if (result.issues.length === 0) {
      lines.push('✅ No critical issues found');
      lines.push('');
      return;
    }

    lines.push(`❌ Issues Found: ${result.issues.length}`);
    lines.push('');

    const bySeverity = this.groupIssuesBySeverity(result.issues);
    for (const [severity, issues] of bySeverity.entries()) {
      lines.push(`${this.getSeverityIcon(severity)} ${severity.toUpperCase()} (${issues.length}):`);
      for (const issue of issues.slice(0, 5)) {
        lines.push(`   Wave ${issue.waveNumber}: ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`   💡 ${issue.suggestion}`);
        }
      }
      if (issues.length > 5) {
        lines.push(`   ... and ${issues.length - 5} more`);
      }
      lines.push('');
    }
  }

  private groupIssuesBySeverity(issues: WaveValidationIssue[]): Map<string, WaveValidationIssue[]> {
    const bySeverity = new Map<string, WaveValidationIssue[]>();

    for (const issue of issues) {
      const currentIssues = bySeverity.get(issue.severity) ?? [];
      currentIssues.push(issue);
      bySeverity.set(issue.severity, currentIssues);
    }

    return bySeverity;
  }

  private appendOptimizationSection(lines: string[], result: WaveValidationResult): void {
    if (result.optimizations.length === 0) {
      return;
    }

    lines.push(`💡 Optimization Suggestions: ${result.optimizations.length}`);
    lines.push('');

    for (const opt of result.optimizations.slice(0, 5)) {
      lines.push(`   Wave ${opt.waveNumber}: ${opt.type.toUpperCase()}`);
      lines.push(`   ${opt.description}`);
      lines.push(`   Confidence: ${(opt.confidence * 100).toFixed(0)}%`);
      lines.push(`   Impact: ${opt.estimatedImprovement}`);
      lines.push('');
    }
  }

  private appendRiskAssessmentSection(lines: string[], result: WaveValidationResult): void {
    if (result.riskAssessments.length === 0) {
      return;
    }

    lines.push('📊 Risk Assessment by Wave:');
    lines.push('');

    for (const assessment of result.riskAssessments) {
      lines.push(
        `   Wave ${assessment.waveNumber}: ${this.getRiskIcon(
          assessment.riskLevel
        )} ${assessment.riskLevel.toUpperCase()}`
      );

      if (assessment.riskFactors.length > 0) {
        lines.push(`   Factors: ${assessment.riskFactors.join(', ')}`);
      }

      if (assessment.mitigation.length > 0) {
        lines.push(`   Mitigation: ${assessment.mitigation.join(', ')}`);
      }
    }
  }

  /**
   * Get risk level icon
   */
  private getRiskIcon(risk: string): string {
    switch (risk) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    return this.getRiskIcon(severity);
  }
}
