/**
 * Agentforce AI Token Limits and Cost Management
 *
 * Most LLM providers have context window limits:
 * - Claude Sonnet 3.5: 200K tokens
 * - GPT-4 Turbo: 128K tokens
 * - Einstein GPT: 32K tokens (Salesforce hosted)
 *
 * Token estimation: ~4 chars per token for code/JSON
 */

/**
 * Maximum tokens per Agentforce request
 * Conservative limit to account for prompt + response
 */
export const MAX_TOKENS_PER_REQUEST = 180_000; // Leave 20K for response

/**
 * Average tokens per Salesforce component (JSON format)
 * Estimated from real org analysis
 */
export const AVG_TOKENS_PER_COMPONENT = {
  /** Simple component (CustomLabel, Translation) */
  SIMPLE: 50,
  /** Standard component (ApexClass, CustomObject field) */
  STANDARD: 200,
  /** Complex component (Flow, Layout, Profile) */
  COMPLEX: 500,
  /** Very large (CustomObject with 100+ fields, Permission Set) */
  VERY_LARGE: 1500,
} as const;

/**
 * Maximum components per AI analysis request
 * Based on token limits and average component size
 */
export const MAX_COMPONENTS_PER_BATCH = {
  /** Simple components only */
  SIMPLE: Math.floor(MAX_TOKENS_PER_REQUEST / AVG_TOKENS_PER_COMPONENT.SIMPLE), // ~3600
  /** Standard components */
  STANDARD: Math.floor(MAX_TOKENS_PER_REQUEST / AVG_TOKENS_PER_COMPONENT.STANDARD), // ~900
  /** Complex components */
  COMPLEX: Math.floor(MAX_TOKENS_PER_REQUEST / AVG_TOKENS_PER_COMPONENT.COMPLEX), // ~360
  /** Very large components */
  VERY_LARGE: Math.floor(MAX_TOKENS_PER_REQUEST / AVG_TOKENS_PER_COMPONENT.VERY_LARGE), // ~120
  /** Conservative default (mixed sizes) */
  DEFAULT: 250,
} as const;

/**
 * Token limits by model (as of December 2024)
 *
 * 🆕 Gemini 1.5 Pro has massive 2M context window!
 * This changes the game for large org analysis.
 */
export const MODEL_TOKEN_LIMITS = {
  // Anthropic Claude (200K context)
  'claude-3-5-sonnet': 200_000,
  'claude-3-opus': 200_000,

  // OpenAI GPT
  'gpt-4o': 128_000, // Latest GPT-4 Omni
  'gpt-4-turbo': 128_000,
  'gpt-4': 8000, // Legacy

  // Google Gemini (HUGE context windows!)
  'gemini-1.5-pro': 2_000_000, // 2M tokens! 🚀
  'gemini-1.5-flash': 1_000_000, // 1M tokens
  'gemini-ultra': 1_000_000, // Future model

  // Salesforce Einstein
  'einstein-gpt': 32_000,
} as const;

/**
 * Cost per 1K tokens (approximate, as of December 2024)
 * Updated with latest pricing
 */
export const COST_PER_1K_TOKENS = {
  // Anthropic Claude 3.5
  'claude-3-5-sonnet': {
    input: 0.003, // $3 per 1M tokens
    output: 0.015, // $15 per 1M tokens
  },
  'claude-3-opus': {
    input: 0.015, // $15 per 1M tokens
    output: 0.075, // $75 per 1M tokens
  },

  // OpenAI GPT-4
  'gpt-4o': {
    input: 0.005, // $5 per 1M tokens (cheaper than turbo!)
    output: 0.015, // $15 per 1M tokens
  },
  'gpt-4-turbo': {
    input: 0.01, // $10 per 1M tokens
    output: 0.03, // $30 per 1M tokens
  },
  'gpt-4': {
    input: 0.03, // $30 per 1M tokens (expensive legacy)
    output: 0.06, // $60 per 1M tokens
  },

  // Google Gemini (VERY competitive pricing!)
  'gemini-1.5-pro': {
    input: 0.001_25, // $1.25 per 1M tokens (cheapest!)
    output: 0.005, // $5 per 1M tokens
  },
  'gemini-1.5-flash': {
    input: 0.000_075, // $0.075 per 1M tokens (ultra cheap!)
    output: 0.0003, // $0.30 per 1M tokens
  },
  'gemini-ultra': {
    input: 0.003, // Estimated (future model)
    output: 0.01,
  },

  // Salesforce Einstein
  'einstein-gpt': {
    input: 0.02, // Estimated - Salesforce pricing
    output: 0.06,
  },
} as const;

/**
 * Estimates tokens for a given text
 * Rule of thumb: ~4 characters per token for code/JSON
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimates cost for an AI analysis request
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: keyof typeof COST_PER_1K_TOKENS
): number {
  const costs = COST_PER_1K_TOKENS[model];
  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;
  return inputCost + outputCost;
}

/**
 * Checks if a batch of components will exceed token limits
 */
export function willExceedTokenLimit(
  components: unknown[],
  model: keyof typeof MODEL_TOKEN_LIMITS,
  estimatedTokensPerComponent = AVG_TOKENS_PER_COMPONENT.STANDARD
): { exceeds: boolean; estimatedTokens: number; maxAllowed: number } {
  const estimatedTokens = components.length * estimatedTokensPerComponent;
  const maxAllowed = MODEL_TOKEN_LIMITS[model];

  return {
    exceeds: estimatedTokens > MAX_TOKENS_PER_REQUEST,
    estimatedTokens,
    maxAllowed,
  };
}

/**
 * Calculates optimal batch size for components
 */
export function calculateOptimalBatchSize(
  totalComponents: number,
  model: keyof typeof MODEL_TOKEN_LIMITS,
  componentComplexity: keyof typeof AVG_TOKENS_PER_COMPONENT = 'STANDARD'
): {
  batchSize: number;
  totalBatches: number;
  estimatedCostPerBatch: number;
  totalEstimatedCost: number;
} {
  const tokensPerComponent = AVG_TOKENS_PER_COMPONENT[componentComplexity];
  const maxComponentsPerBatch = Math.floor(MAX_TOKENS_PER_REQUEST / tokensPerComponent);

  const batchSize = Math.min(maxComponentsPerBatch, MAX_COMPONENTS_PER_BATCH.DEFAULT);
  const totalBatches = Math.ceil(totalComponents / batchSize);

  // Estimate cost (assuming 2K tokens output per batch)
  const inputTokensPerBatch = batchSize * tokensPerComponent;
  const outputTokensPerBatch = 2000;
  const costPerBatch = estimateCost(inputTokensPerBatch, outputTokensPerBatch, model);

  return {
    batchSize,
    totalBatches,
    estimatedCostPerBatch: costPerBatch,
    totalEstimatedCost: costPerBatch * totalBatches,
  };
}

/**
 * Batch strategy recommendations
 */
export const BATCH_STRATEGY = {
  /**
   * For small orgs (<500 components)
   * Single batch analysis - faster, simpler
   */
  SINGLE_BATCH: 'single',

  /**
   * For medium orgs (500-2000 components)
   * Multiple batches with dependency-aware grouping
   */
  MULTI_BATCH: 'multi',

  /**
   * For large orgs (>2000 components)
   * Selective analysis - only complex/ambiguous components go through AI
   * Use static analysis for obvious dependencies
   */
  SELECTIVE: 'selective',

  /**
   * For very large orgs (>5000 components)
   * Hybrid approach - AI for critical path, heuristics for rest
   */
  HYBRID: 'hybrid',
} as const;

/**
 * Get recommended batch strategy based on org size
 */
export function getRecommendedBatchStrategy(totalComponents: number): keyof typeof BATCH_STRATEGY {
  if (totalComponents < 500) return 'SINGLE_BATCH';
  if (totalComponents < 2000) return 'MULTI_BATCH';
  if (totalComponents < 5000) return 'SELECTIVE';
  return 'HYBRID';
}

/**
 * Get recommended model based on org size and budget
 */
export function getRecommendedModel(
  orgSize: number,
  budget: 'low' | 'medium' | 'high'
): keyof typeof MODEL_TOKEN_LIMITS {
  // For massive orgs (>10K components), Gemini is the only option
  if (orgSize > 10_000) {
    return budget === 'low' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
  }

  // For large orgs (5K-10K), prefer high context models
  if (orgSize > 5000) {
    if (budget === 'low') return 'gemini-1.5-flash';
    if (budget === 'medium') return 'gemini-1.5-pro';
    return 'claude-3-5-sonnet';
  }

  // For medium orgs (1K-5K), balance cost and quality
  if (orgSize > 1000) {
    if (budget === 'low') return 'gemini-1.5-flash';
    if (budget === 'medium') return 'gpt-4o';
    return 'claude-3-5-sonnet';
  }

  // For small orgs (<1K), any modern model works
  if (budget === 'low') return 'gemini-1.5-flash';
  if (budget === 'medium') return 'gpt-4o';
  return 'claude-3-5-sonnet';
}

/**
 * Compare models for a given workload
 */
export function compareModels(
  totalComponents: number,
  avgTokensPerComponent: number
): Array<{
  model: keyof typeof MODEL_TOKEN_LIMITS;
  canFitInSingleBatch: boolean;
  batchesNeeded: number;
  estimatedCost: number;
  recommendation: string;
}> {
  const totalTokens = totalComponents * avgTokensPerComponent;

  return Object.entries(MODEL_TOKEN_LIMITS).map(([model, limit]) => {
    const canFit = totalTokens <= (limit as number) * 0.9; // 90% safety margin
    const batchesNeeded = canFit ? 1 : Math.ceil(totalTokens / ((limit as number) * 0.9));

    const costs = COST_PER_1K_TOKENS[model as keyof typeof COST_PER_1K_TOKENS];
    const inputCost = (totalTokens / 1000) * costs.input * batchesNeeded;
    const outputCost = (2000 / 1000) * costs.output * batchesNeeded; // Assume 2K output per batch

    let recommendation = '';
    if (model.includes('gemini') && totalComponents > 5000) {
      recommendation = '🚀 Best for large orgs';
    } else if (model.includes('claude') && totalComponents < 2000) {
      recommendation = '⭐ Best quality';
    } else if (model.includes('gpt-4o')) {
      recommendation = '⚖️ Balanced option';
    } else if (model === 'gemini-1.5-flash') {
      recommendation = '💰 Most cost-effective';
    }

    return {
      model: model as keyof typeof MODEL_TOKEN_LIMITS,
      canFitInSingleBatch: canFit,
      batchesNeeded,
      estimatedCost: inputCost + outputCost,
      recommendation,
    };
  });
}
