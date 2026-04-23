/**
 * AI Prompt Builder - US-058
 * Build effective AI prompts with context and token optimization
 *
 * @ac US-058-AC-1: Context-aware prompt generation
 * @ac US-058-AC-2: Include relevant metadata snippets
 * @ac US-058-AC-3: Optimize token usage
 * @ac US-058-AC-4: Template-based prompts
 * @ac US-058-AC-5: Version prompts
 * @ac US-058-AC-6: A/B test prompts
 * @issue #58
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('PromptBuilder');

export type PromptTemplate = {
  name: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  maxTokens: number;
  temperature: number;
};

export type PromptContext = {
  components?: unknown[];
  waves?: unknown[];
  dependencies?: unknown[];
  metadata?: Record<string, unknown>;
  limits?: {
    maxComponents?: number;
    maxSnippetLength?: number;
  };
};

export type BuildPromptOptions = {
  template: string;
  context: PromptContext;
  variant?: 'A' | 'B';
};

/**
 * @ac US-058-AC-4: Template-based prompts
 * Predefined prompt templates
 */
const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  'dependency-inference': {
    name: 'Dependency Inference',
    version: '1.0.0',
    systemPrompt: 'You are an expert Salesforce metadata analyzer specialized in finding implicit dependencies.',
    userPromptTemplate: `Analyze these components and infer non-obvious dependencies:

Components: {{components}}

Look for dynamic references, implicit dependencies, and business logic relationships.
Return JSON array of dependencies with confidence scores.`,
    maxTokens: 2000,
    temperature: 0.2,
  },

  'wave-validation': {
    name: 'Wave Validation',
    version: '1.0.0',
    systemPrompt: 'You are a Salesforce deployment architect expert in wave optimization.',
    userPromptTemplate: `Validate these deployment waves for issues:

Waves: {{waves}}

Identify business logic issues, performance concerns, and risks.
Return JSON with issues, optimizations, and risk assessments.`,
    maxTokens: 3000,
    temperature: 0.1,
  },

  'priority-analysis': {
    name: 'Priority Analysis',
    version: '1.0.0',
    systemPrompt: 'You are a Salesforce architect expert in deployment prioritization.',
    userPromptTemplate: `Analyze component priorities for deployment:

Components: {{components}}
Organization Type: {{orgType}}
Industry: {{industry}}

Consider business criticality and failure impact.
Return JSON array of priority recommendations.`,
    maxTokens: 2000,
    temperature: 0.3,
  },
};

/**
 * @ac US-058-AC-1: Context-aware prompt generation
 * @ac US-058-AC-2: Include relevant metadata snippets
 */
export class PromptBuilder {
  public constructor(maxTokenEstimate: number = 4000) {
    logger.debug('Prompt builder initialized', { maxTokenEstimate });
  }

  /**
   * @ac US-058-AC-1: Context-aware prompt generation
   * Build prompt from template and context
   */
  public buildPrompt(options: BuildPromptOptions): {
    systemPrompt: string;
    userPrompt: string;
    estimatedTokens: number;
  } {
    const template = PROMPT_TEMPLATES[options.template];
    if (!template) {
      throw new Error(`Template '${options.template}' not found`);
    }

    logger.debug('Building prompt', {
      template: options.template,
      variant: options.variant,
    });

    // Get variant-specific template if A/B testing
    const userTemplate = this.getTemplateVariant(template, options.variant);

    // Optimize context for token usage
    const optimizedContext = this.optimizeContext(options.context);

    // Replace placeholders
    let userPrompt = userTemplate;
    for (const [key, value] of Object.entries(optimizedContext)) {
      const placeholder = `{{${key}}}`;
      const replacement = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      userPrompt = userPrompt.replaceAll(placeholder, replacement);
    }

    // Estimate tokens
    const estimatedTokens = this.estimateTokens(template.systemPrompt + userPrompt);

    logger.info('Prompt built', {
      template: template.name,
      version: template.version,
      estimatedTokens,
    });

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
      estimatedTokens,
    };
  }

  /**
   * @ac US-058-AC-6: A/B test prompts
   * Get template variant for A/B testing
   */
  private getTemplateVariant(template: PromptTemplate, variant?: 'A' | 'B'): string {
    if (!variant || variant === 'A') {
      return template.userPromptTemplate;
    }

    // Variant B: more concise version (remove extra line breaks, simplify language)
    return template.userPromptTemplate
      .replace(/\n\n/g, '\n')
      .replace(/Look for dynamic references, implicit dependencies, and business logic relationships\.\n/, '');
  }

  /**
   * @ac US-058-AC-3: Optimize token usage
   * Optimize context to reduce token count
   */
  private optimizeContext(context: PromptContext): Record<string, unknown> {
    const optimized: Record<string, unknown> = {};
    const limits = context.limits ?? {};

    // Limit components
    if (context.components) {
      const maxComponents = limits.maxComponents ?? 20;
      optimized.components = Array.isArray(context.components)
        ? context.components.slice(0, maxComponents)
        : context.components;
    }

    // Limit waves
    if (context.waves) {
      optimized.waves = Array.isArray(context.waves) ? context.waves.slice(0, 10) : context.waves;
    }

    // Limit dependencies
    if (context.dependencies) {
      optimized.dependencies = Array.isArray(context.dependencies)
        ? context.dependencies.slice(0, 30)
        : context.dependencies;
    }

    // Include other metadata as-is
    if (context.metadata) {
      for (const [key, value] of Object.entries(context.metadata)) {
        optimized[key] = value;
      }
    }

    return optimized;
  }

  /**
   * @ac US-058-AC-3: Optimize token usage
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get available templates
   */
  public getTemplates(): string[] {
    return Object.keys(PROMPT_TEMPLATES);
  }

  /**
   * Get template details
   */
  public getTemplate(name: string): PromptTemplate | undefined {
    return PROMPT_TEMPLATES[name];
  }

  /**
   * @ac US-058-AC-5: Version prompts
   * Get template version
   */
  public getTemplateVersion(name: string): string | undefined {
    return PROMPT_TEMPLATES[name]?.version;
  }
}
